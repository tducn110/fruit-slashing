#!/bin/sh

# R4 creates this explicit dev packaging handoff for R5. Editing catalog
# origins or switching to prod requires the coordinated roadmap procedure.
GAME_NAME="fruit-slashing"
GAME_TITLE="Chém Lạc Vùng Cao"
GAME_DESCRIPTION="Winkgames iframe-only Fruit Slashing pilot"

GAME_ID="11111111-1111-4111-8111-111111111111"
ENVIRONMENT="dev"
PROTOCOL_VERSION="1"
BRIDGE_VERSION="9.0.0"
ALLOWED_PARENT_ORIGINS="https://dev-winkgames.papastudio.net"

DOMAIN="dev-fruit-slashing.papastudio.net"

STACK_NAME="papastudio-winkgames"
SERVICE_NAME="fruit-slashing"
REGISTRY="registry2.papagroup.net"
IMAGE_NAME="winkgames/games/fruit-slashing"
IMAGE_TAG="r4-local-only"
NETWORK="traefik-public"
NGINX_PORT="80"
CERT_RESOLVER="myresolver"
REPLICAS="1"
RESTART_POLICY="on-failure"

FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
SERVICE_FULL_NAME="${STACK_NAME}_${SERVICE_NAME}"
