# 🎮 Game Template - Quick Setup Guide

## 📋 Hướng dẫn sử dụng template

Template này giúp bạn deploy game mới nhanh chóng. Chỉ cần:
1. Copy template này
2. Đổi tên & config cơ bản
3. Deploy lên VPS

---

## 🚀 Quick Start (3 bước)

### Bước 1: Copy & Rename Template
```bash
# Copy template
cp -r game-template my-new-game

# Hoặc nếu ở folder khác:
cp -r /path/to/wink/game-template /path/to/games/my-new-game
# cp -r /Users/ddwsc/Desktop/papagroup/web/wink/game-template .

cd my-new-game
```

### Issue: "Please edit game.config.sh and set GAME_NAME"

**Cause:** Haven't edited game.config.sh

**Fix:**
```bash
nano game.config.sh
# Change GAME_NAME from "my-game" to actual name
```

### Bước 3: Thêm game files & Deploy
```bash
# Add game files (index.html, assets, etc.)
# ... copy your game files here ...

# Deploy
./deploy.sh
```

Done! 🎉

---

## 📂 Template Structure

```
game-template/
├── README.md              # File này
├── game.config.sh        # Config file - EDIT THIS!
├── deploy.sh             # Deploy script
├── docker-stack.yml      # Docker Stack config
├── Dockerfile            # Docker build config
├── .dockerignore         # Files to ignore
├── etc/
│   └── nginx.conf        # Nginx config
└── [YOUR GAME FILES]     # Add your game here
    ├── index.html
    ├── assets/
    └── ...
```

---

## 🔧 Chi tiết từng file

### 1. `game.config.sh` (BẮT BUỘC EDIT)
File config chính, chứa tất cả thông tin về game:
```bash
GAME_NAME="my-game"                           # Tên game (slug)
GAME_TITLE="My Game"                          # Tiêu đề
DOMAIN="my-game.papastudio.net"              # Domain
STACK_NAME="papastudio-my-game"              # Stack name (papastudio for games)
REGISTRY="registry2.papagroup.net"           # Registry URL
IMAGE_NAME="winkgames/games/my-game"         # Image name (Harbor project: winkgames)
```

### 2. `deploy.sh`
Script tự động:
- Load config từ `game.config`
- Build Docker image
- Push to registry (optional)
- Deploy to VPS using Docker Stack

**Usage:**
```bash
./deploy.sh              # Deploy với push to registry
./deploy.sh --local      # Deploy local (không push)
```

### 3. `docker-stack.yml`
Docker Stack configuration với **Traefik labels**.

**Quan trọng:** 
- VPS dùng **Traefik** làm reverse proxy
- Tất cả subdomain → VPS IP → Traefik routing đến đúng service
- Script tự động generate file này từ `game.config.sh`

Auto-config:
- Traefik routing (Host rule)
- SSL auto via Let's Encrypt
- Network setup (traefik-public)

### 4. `Dockerfile`
Build static game với Nginx.
- Multi-stage build
- Optimized size
- Production ready

### 5. `etc/nginx.conf`
Nginx config với:
- **Chỉ serve static files** (không làm routing/proxy)
- CORS headers (cho iframe embedding)
- Gzip compression
- Cache control
- Security headers

**Lưu ý:** Routing được handle bởi **Traefik**, không phải Nginx!

---

## 📝 Example: Deploy "Stickman Hook"

```bash
# 1. Copy template
cp -r game-template stickman-hook
cd stickman-hook

# 2. Edit config
nano game.config.sh
# Set:
#   GAME_NAME="stickman-hook"
#   GAME_TITLE="Stickman Hook"
#   DOMAIN="stickman-hook.papastudio.net"
#   STACK_NAME="papagroup-stickman-hook"

# 3. Add game files
cp -r /path/to/stickman-game-files/* .

# 4. Create DNS record (Cloudflare)
# Type: A
# Name: stickman-hook
# Content: <VPS_IP>

# 5. Deploy
chmod +x deploy.sh
./deploy.sh

# 6. Verify
# Open: https://stickman-hook.papastudio.net
```

---

## 🌐 DNS Setup (Per Game)

Mỗi game cần 1 DNS A record trên Cloudflare:

```
Type: A
Name: [game-name]          # ví dụ: stickman-hook
Content: [VPS_IP]          # ví dụ: 123.45.67.89
Proxy: ON (orange cloud)   # Enable Cloudflare CDN
TTL: Auto
```

**Example:**
| Name | Type | Content | Proxy |
|------|------|---------|-------|
| monkey-mart | A | 123.45.67.89 | ON |
| stickman-hook | A | 123.45.67.89 | ON |
| moto-x3m | A | 123.45.67.89 | ON |

---

## 🔄 Update Existing Game

```bash
# 1. Edit game files
cd my-game
# ... make changes ...

# 2. Redeploy
./deploy.sh

# Done! Service auto-updates
```

---

## 🐛 Troubleshooting

### Deploy script fails?
```bash
# Make executable
chmod +x deploy.sh

# Check config
cat game.config.sh
```

### Service not starting?
```bash
# Check logs
docker service logs papagroup-[game-name]_game

# Check service status
docker service ps papagroup-[game-name]_game
```

### Game shows blank?
- Check CORS in `etc/nginx.conf`
- Check browser console for errors
- Verify all game files are copied

### SSL not working?
- Wait 1-2 minutes for Let's Encrypt
- Check DNS is pointing correctly
- Check Traefik logs

---

## 📊 Monitoring

```bash
# List all game services
docker service ls | grep papagroup

# Check specific game
docker service ps papagroup-[game-name]_game

# View logs
docker service logs -f papagroup-[game-name]_game

# Service info
docker service inspect papagroup-[game-name]_game
```

---

## 🎯 Checklist

- [ ] Copy template to new folder
- [ ] Edit `game.config` với game info
- [ ] Add game files (index.html, assets)
- [ ] Create DNS A record on Cloudflare
- [ ] Make deploy.sh executable: `chmod +x deploy.sh`
- [ ] Deploy: `./deploy.sh`
- [ ] Verify URL works
- [ ] Add game to web tổng's `games.js`
- [ ] Redeploy web tổng

---

## 💡 Tips

1. **Test local trước:** Mở `index.html` trong browser để test
2. **Version control:** Mỗi game nên có git repo riêng
3. **Backup:** Export docker image: `docker save -o backup.tar [image]`
4. **Monitor:** Set up uptime monitoring cho mỗi game
5. **CDN:** Cloudflare auto-cache static assets

---

## 🔗 Related Files

- Web tổng: `/path/to/wink/src/data/games.js` - Add game info here
- Deploy docs: `/path/to/wink/GAME_DEVELOPMENT_FLOW.md`

---

**Template version:** 1.0
**Last updated:** October 2025
