#!/bin/bash
# ========================================
# Game Configuration File
# ========================================
# IMPORTANT: Edit these values for your game
# After editing, save and run: ./deploy.sh
# ========================================

# Game Information
GAME_NAME="bo-lac-fruit-slashing"                    # Slug name (lowercase, hyphens only)
GAME_TITLE="Bo Lac Fruit Slashing"                   # Display title
GAME_DESCRIPTION="A fun fruit slashing game"     # Short description

# Domain Configuration
DOMAIN="bo-lac-fruit-slashing.papastudio.net"        # Full domain for this game

# Docker Configuration
STACK_NAME="papastudio-winkgames"         # Docker stack name (all games in one stack)
SERVICE_NAME="bo-lac-fruit-slashing"                     # Service name = game slug (unique per game)

# Registry Configuration
REGISTRY="registry2.papagroup.net"     # Docker registry URL
IMAGE_NAME="winkgames/games/bo-lac-fruit-slashing"   # Image name in registry (change 'my-game' to your game name)
IMAGE_TAG="1.6"                      # Image tag (latest, v1.0, etc.)

# Network Configuration
NETWORK="traefik-public"                # Traefik network name

# Port Configuration
NGINX_PORT="80"                         # Nginx internal port (usually 80)

# ========================================
# Advanced Settings (rarely need changes)
# ========================================

# Traefik Configuration
CERT_RESOLVER="myresolver"              # Let's Encrypt resolver name (same as web tổng)

# Deployment Settings
REPLICAS="1"                            # Number of replicas
RESTART_POLICY="on-failure"             # Restart policy

# ========================================
# DO NOT EDIT BELOW (auto-generated)
# ========================================

FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
SERVICE_FULL_NAME="${STACK_NAME}_${SERVICE_NAME}"
