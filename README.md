# Chém Lạc — Wink iframe pilot

Web game chém trái cây xây bằng React, Vite và PixiJS v8. Bản pilot này chỉ
hỗ trợ chạy trong iframe của Wink hoặc R2 local harness. Certified bridge báo
`PARENT_REQUIRED` khi trang được mở top-level và không tự tạo identity, token
hay authority dự phòng.

## Kiến trúc

- `src/game/core.ts`: game state thuần, seeded RNG, fixed-step physics và scoring.
- `src/components/game/FruitGame.tsx`: PixiJS renderer, input sampling, lifecycle và hiệu ứng.
- `src/integrations/wink`: typed adapter duy nhất cho public `window.WinkBridge`.
- `src/hooks/useScoreData.ts`: leaderboard/score remote-first qua scoped game session.
- `src/lib/localScores.ts`: chỉ được dùng trong explicit offline development mode.
- `public/wink-runtime-config.json`: public config không chứa secret; chỉ hỗ trợ `dev` và `prod`.

Game code không đọc raw token, API base, anonymous ID hay tự gọi Wink API.
Primary Wink access token không đi vào iframe. Scoped game token do certified
bridge giữ trong memory và không được ghi vào URL, storage, cookie, DOM hay
diagnostics.

## Toolchain

Sử dụng Node.js 22.x, npm 11.x và lockfile npm đã pin:

```bash
npm install
npm run verify:wink-bridge
```

Bridge certification hiện tại:

- bridge `9.0.0`;
- protocol `1`;
- game ID `11111111-1111-4111-8111-111111111111`;
- SHA-256 `afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb`.

## Chạy qua R2 iframe harness

Khởi động Fruit game ở terminal thứ nhất:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Khởi động canonical R2 harness ở terminal thứ hai, trỏ vào Wink BE development:

```bash
node /path/to/wink/game-template/dev-server.mjs \
  --api-base http://127.0.0.1:3000/api/v1
```

Mở `http://127.0.0.1:8787`, giữ game URL
`http://127.0.0.1:5173`, rồi chọn anonymous hoặc seeded authenticated mode.
Authenticated mode cần `DEV_TEST_AUTH_SECRET` chỉ trong Node harness process;
không đặt secret vào browser, URL, runtime config hay source repository.

Anonymous có thể đọc leaderboard và complete round nhưng submit score phải trả
`CAPABILITY_DENIED`. Seeded authenticated non-guest chỉ submit được khi scoped
capability cho phép. Completion và score submission là hai operation độc lập.

Nếu checkout Wink không nằm ở sibling path mặc định của workspace, đặt
`WINK_R2_TEMPLATE_DIR` khi chạy `npm run certify:c4`; `WINK_CERTIFIED_TEMPLATE_DIR`
có thể dùng cho `npm run sync:wink-bridge` và `npm run verify:wink-bridge`.

## Offline development — không dùng để certify

Local score chỉ bật bằng flag explicit dưới đây và Vite chỉ chấp nhận flag này
ở development mode:

```bash
VITE_WINK_OFFLINE_MODE=true npm run dev
```

Offline mode là tiện ích phát triển không chứng minh iframe/session/security
contract và không được tính là C4 success. Không dùng flag này trong production
build hoặc R2 harness certification.

## Kiểm tra

```bash
npm test
npm run typecheck
npm run build
npm run verify:wink-bridge
npm run verify:docker-headers
```

`npm run build` tự chạy bridge verification trước Vite build. Warning hiện tại
cho `pixi-vendor` khoảng 520 kB là non-blocking trong R4.

`npm run verify:docker-headers` build một image tạm, chạy Nginx thật và kiểm tra
`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` trên
health route, SPA/deep-link, bridge và runtime config; image/container tạm được
dọn sau khi kiểm tra. Có thể truyền policy khác bằng
`WINK_DOCKER_ALLOWED_PARENT_ORIGINS`.

## Deployment boundary

R4 chỉ tạo static game artifact và public runtime config. Không push hoặc
deploy từ pilot này. Reverse-proxy direct-subdomain blocking thuộc release
hardening/R5, không thuộc Fruit adapter.
