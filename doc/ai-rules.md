# AI Instructions / Codex Rules

Project rules for Speed Click Game:

* `src/game/core.ts` là source of truth cho gameplay, physics, spawn, score, hitbox và coordinate math. File này không được import React, PixiJS, DOM API, Firebase hoặc browser-only API.
* PixiJS chỉ phụ trách rendering, canvas input tần suất cao, sprite, particle, slash effect và feedback hình ảnh. Không đặt gameplay rule mới trong PixiJS hooks.
* React phụ trách screen flow, auth, Firebase/localStorage, overlay UI, HUD, modal, settings và leaderboard.
* PixiJS resource phải được đóng gói trong hook riêng theo pattern `useFeatureName`. Hook tạo ticker/listener/sprite/container/particle thì phải có cleanup tương ứng.
* Cleanup phải idempotent và an toàn với React StrictMode double mount/unmount. Chỉ destroy resource mà hook đó sở hữu; không destroy shared texture/cache nếu ownership không rõ.
* Không hardcode gameplay theo pixel màn hình. Dùng `WORLD_WIDTH`, `WORLD_HEIGHT`, `getGameConfig()`, `renderScale` và `screenToWorld()` để mapping desktop/mobile.
* UI overlay game đặt trong `src/components/game/`. UI app/landing/modal chung đặt trong `src/components/ui/`. Render PixiJS đặt trong `src/features/game/render/`.
* CSS/CSS Modules dùng cho game-specific UI, overlay, animation và canvas wrapper. Tailwind nếu có thì chỉ dùng cho layout/spacing/typography đơn giản. Không style cùng một property bằng cả Tailwind và CSS module trên cùng element.
* Firebase chỉ được gọi ở flow meta như save score, leaderboard, auth. In-game loop không được phụ thuộc network. Phải có localStorage fallback khi user offline, chưa đăng nhập hoặc Firebase lỗi.
* Mọi thay đổi physics/gameplay như gravity, hitbox, spawn, score, trajectory phải có test trong `core.test.ts` và không cần mount DOM/canvas.
