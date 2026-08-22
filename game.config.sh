#!/bin/sh
# =============================================================================
#  Wink mini-game — deployment configuration
#
#  Edit ONLY the PER-GAME INPUT block. Everything below it is derived from the
#  slug and environment, and scripts/verify-game-config.mjs re-derives the same
#  values from the canonical Node contract and fails the deploy on any drift.
#
#  This file is public metadata. Never put a token, password, or secret here.
# =============================================================================

# ----------------------------- PER-GAME INPUT --------------------------------
# Slug: lowercase letters, digits, single hyphens. Becomes the subdomain, the
# service name, and the registry path.
GAME_SLUG="bo-lac-fruit-slashing"

# Display metadata (not used by the runtime contract).
GAME_TITLE="Chém Lạc Vùng Cao"
GAME_DESCRIPTION="Winkgames iframe-only Fruit Slashing pilot"

# The game UUID. Must match public/wink-runtime-config.json and the catalog row
# id. There is one deployed catalog now, so there is one id per game: the one the
# CMS generated when the row was created, which means the row has to exist first.
GAME_ID="36348ccc-1f37-4eca-ad1c-a8a47292ace7"

# "local", "dev" or "prod".
#
# `dev` and `prod` derive identical names because they are the same deployment:
# winkgames.papastudio.net, which the team develops against and whose runtime
# still reports `prod`. See scripts/wink-contract.mjs. When a real production
# host exists, `prod` is what changes.
#
# "local" never deploys — its derived names exist only so this file and the Node
# contract stay in step.
ENVIRONMENT="prod"
# ---------------------------- /PER-GAME INPUT --------------------------------


# ============================ DERIVED — DO NOT EDIT ==========================
PROTOCOL_VERSION="1"
BRIDGE_VERSION="9.1.0"
REGISTRY="registry2.papagroup.net"
NETWORK="traefik-public"
NGINX_PORT="80"
CERT_RESOLVER="myresolver"
REPLICAS="1"
RESTART_POLICY="on-failure"

case "${ENVIRONMENT}" in
  local)
    DOMAIN="local-${GAME_SLUG}.papastudio.net"
    ALLOWED_PARENT_ORIGINS="http://127.0.0.1:3001 http://127.0.0.1:8787"
    STACK_NAME="papastudio-winkgames-local-games"
    IMAGE_NAME="winkgames/local/${GAME_SLUG}"
    ROUTER_NAME="winkgames-minigame-local-${GAME_SLUG}"
    ;;
  # `dev` and `prod` name the same deployment — see scripts/wink-contract.mjs.
  # `staging` was removed with the dev-winkgames deployment on 2026-08-20.
  dev)
    DOMAIN="${GAME_SLUG}.papastudio.net"
    ALLOWED_PARENT_ORIGINS="https://winkgames.papastudio.net http://localhost:3000"
    STACK_NAME="papastudio-winkgames-games"
    IMAGE_NAME="winkgames/prod/${GAME_SLUG}"
    ROUTER_NAME="winkgames-minigame-prod-${GAME_SLUG}"
    ;;
  prod)
    DOMAIN="${GAME_SLUG}.papastudio.net"
    ALLOWED_PARENT_ORIGINS="https://winkgames.papastudio.net http://localhost:3000"
    STACK_NAME="papastudio-winkgames-games"
    IMAGE_NAME="winkgames/prod/${GAME_SLUG}"
    ROUTER_NAME="winkgames-minigame-prod-${GAME_SLUG}"
    ;;
  *)
    printf '%s\n' 'WINK_ENVIRONMENT_INVALID' >&2
    return 2 2>/dev/null || exit 2
    ;;
esac

SERVICE_NAME="${GAME_SLUG}"
SERVICE_FULL_NAME="${STACK_NAME}_${SERVICE_NAME}"
IMAGE_REPOSITORY="${REGISTRY}/${IMAGE_NAME}"
