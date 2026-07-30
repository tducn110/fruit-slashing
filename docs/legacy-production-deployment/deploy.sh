#!/bin/bash

# ========================================
# Game Deployment Script
# ========================================
# Automatically deploys game to VPS using Docker Stack
# Usage: ./deploy.sh [--local]
#   --local: Skip registry push (local deploy only)
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
if [ ! -f "game.config.sh" ]; then
    echo -e "${RED}❌ Error: game.config.sh not found!${NC}"
    echo "Please create game.config.sh file. See README.md for details."
    exit 1
fi

source ./game.config.sh

# Check if --local flag is set
SKIP_PUSH=false
if [ "$1" == "--local" ]; then
    SKIP_PUSH=true
    echo -e "${YELLOW}ℹ️  Local deploy mode (skipping registry push)${NC}"
fi

# Validate configuration
echo -e "${BLUE}🔍 Validating configuration...${NC}"
if [ -z "$GAME_NAME" ] || [ "$GAME_NAME" == "my-game" ]; then
    echo -e "${RED}❌ Error: Please edit game.config and set GAME_NAME${NC}"
    exit 1
fi

if [ -z "$DOMAIN" ] || [ "$DOMAIN" == "my-game.papastudio.net" ]; then
    echo -e "${RED}❌ Error: Please edit game.config and set DOMAIN${NC}"
    exit 1
fi

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo -e "${YELLOW}⚠️  Warning: index.html not found${NC}"
    echo "Make sure you've added your game files before deploying"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploying: ${GAME_TITLE}${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Domain:      ${DOMAIN}"
echo "  Stack:       ${STACK_NAME}"
echo "  Image:       ${FULL_IMAGE}"
echo "  Network:     ${NETWORK}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Build Docker image
echo -e "${BLUE}📦 Building Docker image...${NC}"
docker build -t "${FULL_IMAGE}" .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Push to registry (unless --local)
if [ "$SKIP_PUSH" = false ]; then
    echo ""
    echo -e "${BLUE}⬆️  Pushing to registry...${NC}"
    docker push "${FULL_IMAGE}"

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Push failed!${NC}"
        echo "Tip: Run 'docker login ${REGISTRY}' first"
        exit 1
    fi

    echo -e "${GREEN}✅ Push successful${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping registry push${NC}"
fi

# Generate docker-stack.yml with substituted variables
echo ""
echo -e "${BLUE}📝 Generating docker-stack.yml...${NC}"
cat > docker-stack.yml.tmp << EOF
version: '3.8'

services:
  "${SERVICE_NAME}":
    image: ${FULL_IMAGE}
    networks:
      - ${NETWORK}
    labels:
      # Enable Traefik
      - "traefik.enable=true"

      # Traefik routing for HTTPS (websecure entrypoint)
      - 'traefik.http.routers.${GAME_NAME}.rule=Host(\`${DOMAIN}\`)'
      - "traefik.http.routers.${GAME_NAME}.entrypoints=websecure"
      - "traefik.http.routers.${GAME_NAME}.tls.certresolver=${CERT_RESOLVER}"

      # Service configuration (port Nginx listens on)
      - "traefik.http.services.${GAME_NAME}.loadbalancer.server.port=${NGINX_PORT}"
    deploy:
      replicas: ${REPLICAS}
      restart_policy:
        condition: ${RESTART_POLICY}

networks:
  ${NETWORK}:
    external: true
EOF

# Deploy stack
echo ""
echo -e "${BLUE}🚀 Deploying to Docker Stack...${NC}"
docker stack deploy --with-registry-auth -c docker-stack.yml.tmp "${STACK_NAME}"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deploy failed!${NC}"
    rm docker-stack.yml.tmp
    exit 1
fi

# Clean up temp file
rm docker-stack.yml.tmp

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"

# Wait a bit for service to start
echo ""
echo -e "${BLUE}⏳ Waiting for service to start...${NC}"
sleep 3

# Show service status
echo ""
echo -e "${BLUE}📊 Service status:${NC}"
docker service ps "${SERVICE_FULL_NAME}" 2>/dev/null || echo "Service starting..."

# Show logs
echo ""
echo -e "${BLUE}📋 Recent logs:${NC}"
docker service logs --tail 10 "${SERVICE_FULL_NAME}" 2>/dev/null || echo "No logs yet (service still starting)"

# Final info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✨ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}🌐 Game URL:${NC}"
echo "   https://${DOMAIN}"
echo ""
echo -e "${BLUE}📊 Useful commands:${NC}"
echo "   View logs:    docker service logs -f ${SERVICE_FULL_NAME}"
echo "   Check status: docker service ps ${SERVICE_FULL_NAME}"
echo "   Inspect:      docker service inspect ${SERVICE_FULL_NAME}"
echo "   Scale:        docker service scale ${SERVICE_FULL_NAME}=2"
echo "   Remove:       docker stack rm ${STACK_NAME}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   - Wait 1-2 minutes for SSL certificate"
echo "   - Check DNS points to VPS IP"
echo "   - Add game to web tổng's games.js"
echo ""
