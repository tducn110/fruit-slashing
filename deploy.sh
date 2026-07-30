#!/bin/sh

set -eu
umask 077

if [ ! -f "./game.config.sh" ]; then
  printf '%s\n' 'R5_GAME_CONFIG_MISSING' >&2
  exit 2
fi

# shellcheck source=/dev/null
. ./game.config.sh

if [ "${ENVIRONMENT}" != "dev" ] || \
   [ "${STACK_NAME}" != "papastudio-winkgames-dev-games" ] || \
   [ "${SERVICE_NAME}" != "fruit-slashing" ] || \
   [ "${ROUTER_NAME}" != "winkgames-minigame-dev-fruit-slashing" ] || \
   [ "${DOMAIN}" != "dev-fruit-slashing.papastudio.net" ] || \
   [ "${IMAGE_NAME}" != "winkgames/dev/fruit-slashing" ] || \
   [ "${ALLOWED_PARENT_ORIGINS}" != "https://dev-winkgames.papastudio.net http://127.0.0.1:8787" ]; then
  printf '%s\n' 'R5_GAME_CONFIG_INVALID' >&2
  exit 2
fi

MODE="${1:-}"
case "${MODE}" in
  --check-only|--build-push)
    if [ "$#" -ne 1 ]; then
      printf '%s\n' 'R5_GAME_DEPLOY_ARGUMENT_INVALID' >&2
      exit 2
    fi
    ;;
  --deploy|--rollback)
    if [ "$#" -ne 3 ]; then
      printf '%s\n' 'R5_GAME_DEPLOY_ARGUMENT_INVALID' >&2
      exit 2
    fi
    ;;
  *)
    printf '%s\n' 'R5_GAME_DEPLOY_ARGUMENT_INVALID' >&2
    exit 2
    ;;
esac

SOURCE_SHA="$(git rev-parse HEAD)"
if ! printf '%s\n' "${SOURCE_SHA}" | grep -Eq '^[0-9a-f]{40}$' || \
   ! git diff --quiet || \
   ! git diff --cached --quiet || \
   [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  printf '%s\n' 'R5_GAME_SOURCE_INVALID' >&2
  exit 2
fi

IMAGE_TAG="git-${SOURCE_SHA}"
TAGGED_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
DIGEST_IMAGE_PREFIX="${REGISTRY}/${IMAGE_NAME}@sha256:"
DIGEST_PATTERN='^registry2\.papagroup\.net/winkgames/dev/fruit-slashing@sha256:[0-9a-f]{64}$'

# These gates precede every immutable image publication and dev stack update.
# No harness secret or primary/scoped token is consumed by this script.
export GAME_ID ENVIRONMENT PROTOCOL_VERSION BRIDGE_VERSION
export ALLOWED_PARENT_ORIGINS
export OUTPUT_PATH="./public/wink-runtime-config.json"
node scripts/generate-wink-runtime-config.mjs
npm run verify:wink-bridge
npm test
npm run typecheck
npm run build
WINK_DOCKER_ALLOWED_PARENT_ORIGINS="${ALLOWED_PARENT_ORIGINS}" \
npm run verify:docker-headers

if [ "${MODE}" = "--check-only" ]; then
  printf '%s\n' "{\"schemaVersion\":1,\"code\":\"R5_GAME_CHECK_OK\",\"sourceSha\":\"${SOURCE_SHA}\"}"
  exit 0
fi

if [ "${MODE}" = "--build-push" ]; then
  if docker manifest inspect "${TAGGED_IMAGE}" >/dev/null 2>&1; then
    printf '%s\n' 'R5_IMAGE_TAG_EXISTS' >&2
    exit 2
  fi

  docker build -t "${TAGGED_IMAGE}" .
  PUSH_OUTPUT="$(mktemp "${TMPDIR:-/tmp}/fruit-push.XXXXXX")"
  trap 'rm -f "${PUSH_OUTPUT}"' EXIT HUP INT TERM
  docker push "${TAGGED_IMAGE}" | tee "${PUSH_OUTPUT}"
  PUSH_DIGEST="$(
    sed -n 's/.*digest: \(sha256:[0-9a-f]\{64\}\).*/\1/p' \
      "${PUSH_OUTPUT}" | tail -n 1
  )"
  R5_GAME_IMAGE="${DIGEST_IMAGE_PREFIX}${PUSH_DIGEST#sha256:}"
  if ! printf '%s\n' "${R5_GAME_IMAGE}" | grep -Eq "${DIGEST_PATTERN}"; then
    printf '%s\n' 'R5_IMAGE_DIGEST_INVALID' >&2
    exit 1
  fi
  printf '%s\n' "{\"schemaVersion\":1,\"code\":\"R5_GAME_IMAGE_PUBLISHED\",\"sourceSha\":\"${SOURCE_SHA}\",\"taggedImage\":\"${TAGGED_IMAGE}\",\"digestImage\":\"${R5_GAME_IMAGE}\"}"
  exit 0
fi

R5_GAME_IMAGE="$2"
ROLLBACK_METADATA_PATH="$3"
if ! printf '%s\n' "${R5_GAME_IMAGE}" | grep -Eq "${DIGEST_PATTERN}"; then
  printf '%s\n' 'R5_IMAGE_DIGEST_INVALID' >&2
  exit 2
fi
case "${ROLLBACK_METADATA_PATH}" in
  artifacts/minigame-pilot/*) ;;
  *)
    printf '%s\n' 'R5_ROLLBACK_METADATA_PATH_INVALID' >&2
    exit 2
    ;;
esac
if ! printf '%s\n' "${ROLLBACK_METADATA_PATH}" | \
     grep -Eq '^artifacts/minigame-pilot/[A-Za-z0-9._/-]+\.json$' || \
   printf '%s\n' "${ROLLBACK_METADATA_PATH}" | grep -Eq '(^|/)\.\.(/|$)|//'; then
  printf '%s\n' 'R5_ROLLBACK_METADATA_PATH_INVALID' >&2
  exit 2
fi
ROLLBACK_METADATA_DIR="$(dirname "${ROLLBACK_METADATA_PATH}")"
if [ ! -d "${ROLLBACK_METADATA_DIR}" ]; then
  printf '%s\n' 'R5_ROLLBACK_METADATA_PATH_INVALID' >&2
  exit 2
fi
ARTIFACT_ROOT="$(CDPATH= cd -- artifacts/minigame-pilot && pwd -P)"
ROLLBACK_METADATA_DIR="$(CDPATH= cd -- "${ROLLBACK_METADATA_DIR}" && pwd -P)"
case "${ROLLBACK_METADATA_DIR}" in
  "${ARTIFACT_ROOT}"|"${ARTIFACT_ROOT}"/*) ;;
  *)
    printf '%s\n' 'R5_ROLLBACK_METADATA_PATH_INVALID' >&2
    exit 2
    ;;
esac
ROLLBACK_METADATA_PATH="${ROLLBACK_METADATA_DIR}/$(basename "${ROLLBACK_METADATA_PATH}")"
if [ -L "${ROLLBACK_METADATA_PATH}" ] || [ -e "${ROLLBACK_METADATA_PATH}" ]; then
  printf '%s\n' 'R5_ROLLBACK_METADATA_PATH_INVALID' >&2
  exit 2
fi

STACK_FILE="$(mktemp "${TMPDIR:-/tmp}/fruit-r5-stack.XXXXXX")"
ROLLBACK_METADATA_TMP=""
cleanup() {
  rm -f "${STACK_FILE}"
  if [ -n "${ROLLBACK_METADATA_TMP}" ]; then
    rm -f "${ROLLBACK_METADATA_TMP}"
  fi
}
trap cleanup EXIT HUP INT TERM

{
  echo "version: '3.8'"
  echo "services:"
  echo "  ${SERVICE_NAME}:"
  echo "    image: ${R5_GAME_IMAGE}"
  echo "    networks:"
  echo "      - ${NETWORK}"
  echo "    labels:"
  echo "      - \"traefik.enable=true\""
  echo "      - 'traefik.http.routers.${ROUTER_NAME}.rule=Host(\`${DOMAIN}\`)'"
  echo "      - \"traefik.http.routers.${ROUTER_NAME}.entrypoints=websecure\""
  echo "      - \"traefik.http.routers.${ROUTER_NAME}.tls=true\""
  echo "      - \"traefik.http.routers.${ROUTER_NAME}.tls.certresolver=${CERT_RESOLVER}\""
  echo "      - \"traefik.http.services.${ROUTER_NAME}.loadbalancer.server.port=${NGINX_PORT}\""
  echo "    environment:"
  echo "      - \"ALLOWED_PARENT_ORIGINS=${ALLOWED_PARENT_ORIGINS}\""
  echo "    deploy:"
  echo "      replicas: ${REPLICAS}"
  echo "      restart_policy:"
  echo "        condition: ${RESTART_POLICY}"
  echo "      update_config:"
  echo "        parallelism: 1"
  echo "        order: start-first"
  echo "        failure_action: rollback"
  echo "      rollback_config:"
  echo "        parallelism: 1"
  echo "        order: stop-first"
  echo "      resources:"
  echo "        limits:"
  echo "          cpus: '0.50'"
  echo "          memory: 256M"
  echo "        reservations:"
  echo "          cpus: '0.05'"
  echo "          memory: 64M"
  echo "    logging:"
  echo "      driver: json-file"
  echo "      options:"
  echo "        max-size: 10m"
  echo "        max-file: '3'"
  echo "networks:"
  echo "  ${NETWORK}:"
  echo "    external: true"
} > "${STACK_FILE}"

docker stack config -c "${STACK_FILE}" >/dev/null
PREVIOUS_IMAGE="$(
  docker service inspect "${SERVICE_FULL_NAME}" \
    --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true
)"
if [ -z "${PREVIOUS_IMAGE}" ]; then
  PREVIOUS_IMAGE="none"
fi

docker stack deploy --with-registry-auth \
  -c "${STACK_FILE}" "${STACK_NAME}"

ATTEMPTS="0"
CURRENT_REPLICAS=""
CURRENT_IMAGE=""
UPDATE_STATE=""
while [ "${ATTEMPTS}" -lt 24 ]; do
  CURRENT_REPLICAS="$(
    docker service ls --filter "name=${SERVICE_FULL_NAME}" \
      --format '{{.Replicas}}'
  )"
  CURRENT_IMAGE="$(
    docker service inspect "${SERVICE_FULL_NAME}" \
      --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true
  )"
  UPDATE_STATE="$(
    docker service inspect "${SERVICE_FULL_NAME}" \
      --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}' \
      2>/dev/null || true
  )"
  if [ "${CURRENT_REPLICAS}" = "1/1" ] && \
     [ "${CURRENT_IMAGE}" = "${R5_GAME_IMAGE}" ] && \
     { [ -z "${UPDATE_STATE}" ] || [ "${UPDATE_STATE}" = "completed" ]; }; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 5
done
if [ "${CURRENT_REPLICAS}" != "1/1" ] || \
   [ "${CURRENT_IMAGE}" != "${R5_GAME_IMAGE}" ] || \
   { [ -n "${UPDATE_STATE}" ] && [ "${UPDATE_STATE}" != "completed" ]; }; then
  printf '%s\n' 'R5_GAME_DEPLOY_HEALTH_FAILED' >&2
  exit 1
fi
curl --fail --silent --show-error --max-time 10 \
  "https://${DOMAIN}/health" >/dev/null

ACTION="${MODE#--}"
CREATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
ROLLBACK_METADATA_TMP="$(mktemp "${ROLLBACK_METADATA_PATH}.tmp.XXXXXX")"
printf '%s\n' \
  "{\"schemaVersion\":1,\"action\":\"${ACTION}\",\"createdAt\":\"${CREATED_AT}\",\"sourceSha\":\"${SOURCE_SHA}\",\"stack\":\"${STACK_NAME}\",\"service\":\"${SERVICE_NAME}\",\"previousImage\":\"${PREVIOUS_IMAGE}\",\"nextImage\":\"${R5_GAME_IMAGE}\",\"result\":\"healthy\"}" \
  > "${ROLLBACK_METADATA_TMP}"
chmod 0600 "${ROLLBACK_METADATA_TMP}"
mv "${ROLLBACK_METADATA_TMP}" "${ROLLBACK_METADATA_PATH}"
ROLLBACK_METADATA_TMP=""

printf '%s\n' "{\"schemaVersion\":1,\"code\":\"R5_GAME_DEPLOY_OK\",\"action\":\"${ACTION}\",\"service\":\"${SERVICE_FULL_NAME}\"}"
