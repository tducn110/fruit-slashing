#!/bin/sh

# Production canary release. This file contains public metadata only.
GAME_SLUG="bo-lac-fruit-slashing"
GAME_TITLE="Chém Lạc Vùng Cao"
GAME_DESCRIPTION="Winkgames iframe-only Fruit Slashing pilot"

GAME_ID="36348ccc-1f37-4eca-ad1c-a8a47292ace7"
ENVIRONMENT="prod"
PROTOCOL_VERSION="1"
BRIDGE_VERSION="9.0.0"
REGISTRY="registry2.papagroup.net"
NETWORK="traefik-public"
NGINX_PORT="80"
CERT_RESOLVER="myresolver"
REPLICAS="1"
RESTART_POLICY="on-failure"

case "${ENVIRONMENT}" in
  dev)
    DOMAIN="dev-${GAME_SLUG}.papastudio.net"
    ALLOWED_PARENT_ORIGINS="https://dev-winkgames.papastudio.net http://127.0.0.1:8787"
    STACK_NAME="papastudio-winkgames-dev-games"
    IMAGE_NAME="winkgames/dev/${GAME_SLUG}"
    ROUTER_NAME="winkgames-minigame-dev-${GAME_SLUG}"
    ;;
  prod)
    DOMAIN="${GAME_SLUG}.papastudio.net"
    ALLOWED_PARENT_ORIGINS="https://winkgames.papastudio.net"
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
