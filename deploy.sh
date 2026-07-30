#!/bin/sh

set -eu

if [ ! -f "./game.config.sh" ]; then
  echo "game.config.sh is required" >&2
  exit 1
fi

# shellcheck source=/dev/null
. ./game.config.sh

case "${ENVIRONMENT}" in
  dev|prod) ;;
  *)
    echo "ENVIRONMENT must be dev or prod" >&2
    exit 1
    ;;
esac

if [ -z "${GAME_NAME}" ] || [ -z "${DOMAIN}" ]; then
  echo "GAME_NAME and DOMAIN are required" >&2
  exit 1
fi

SKIP_PUSH="false"
if [ "${1:-}" = "--local" ]; then
  SKIP_PUSH="true"
fi

# These gates run before all image/registry/stack mutation. The harness secret
# and any primary access token are intentionally not consumed here.
export GAME_ID ENVIRONMENT PROTOCOL_VERSION BRIDGE_VERSION
export ALLOWED_PARENT_ORIGINS
export OUTPUT_PATH="./public/wink-runtime-config.json"
node scripts/generate-wink-runtime-config.mjs
npm run verify:wink-bridge
npm run build

docker build -t "${FULL_IMAGE}" .

if [ "${SKIP_PUSH}" = "false" ]; then
  docker push "${FULL_IMAGE}"
fi

STACK_FILE="$(mktemp "${TMPDIR:-/tmp}/fruit-stack.XXXXXX")"
trap 'rm -f "${STACK_FILE}"' EXIT HUP INT TERM

{
  echo "version: '3.8'"
  echo "services:"
  echo "  ${SERVICE_NAME}:"
  echo "    image: ${FULL_IMAGE}"
  echo "    networks:"
  echo "      - ${NETWORK}"
  echo "    labels:"
  echo "      - \"traefik.enable=true\""
  echo "      - \"traefik.http.routers.${GAME_NAME}.rule=Host(\\\`${DOMAIN}\\\`)\""
  echo "      - \"traefik.http.routers.${GAME_NAME}.entrypoints=websecure\""
  echo "      - \"traefik.http.routers.${GAME_NAME}.tls.certresolver=${CERT_RESOLVER}\""
  echo "      - \"traefik.http.services.${GAME_NAME}.loadbalancer.server.port=${NGINX_PORT}\""
  echo "    environment:"
  echo "      - \"ALLOWED_PARENT_ORIGINS=${ALLOWED_PARENT_ORIGINS}\""
  echo "    deploy:"
  echo "      replicas: ${REPLICAS}"
  echo "      restart_policy:"
  echo "        condition: ${RESTART_POLICY}"
  echo "networks:"
  echo "  ${NETWORK}:"
  echo "    external: true"
} > "${STACK_FILE}"

docker stack deploy --with-registry-auth \
  -c "${STACK_FILE}" "${STACK_NAME}"

echo "deployed ${SERVICE_FULL_NAME} from ${FULL_IMAGE}"
