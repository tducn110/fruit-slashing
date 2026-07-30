#!/bin/sh

# R5 dev-only image handoff. Production names and authority are intentionally
# absent; a production release requires a separate reviewed revision.
GAME_NAME="fruit-slashing"
GAME_TITLE="Chém Lạc Vùng Cao"
GAME_DESCRIPTION="Winkgames iframe-only Fruit Slashing pilot"

GAME_ID="11111111-1111-4111-8111-111111111111"
ENVIRONMENT="dev"
PROTOCOL_VERSION="1"
BRIDGE_VERSION="9.0.0"
ALLOWED_PARENT_ORIGINS="https://dev-winkgames.papastudio.net http://127.0.0.1:8787"

DOMAIN="dev-fruit-slashing.papastudio.net"

STACK_NAME="papastudio-winkgames-dev"
SERVICE_NAME="fruit-slashing"
ROUTER_NAME="winkgames-minigame-dev-fruit-slashing"
REGISTRY="registry2.papagroup.net"
IMAGE_NAME="winkgames/dev/fruit-slashing"
NETWORK="traefik-public"
NGINX_PORT="80"
CERT_RESOLVER="myresolver"
REPLICAS="1"
RESTART_POLICY="on-failure"

SERVICE_FULL_NAME="${STACK_NAME}_${SERVICE_NAME}"
