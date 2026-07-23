# Chém Lạc

Web game chém trái cây xây bằng React, Vite và PixiJS v8. Điểm và bảng xếp hạng được lưu local trong trình duyệt, không cần đăng nhập hoặc backend riêng.

## Kiến trúc

- `src/game/core.ts`: game state thuần, seeded RNG, fixed-step physics và scoring.
- `src/components/game/FruitGame.tsx`: PixiJS renderer, input sampling và hiệu ứng.
- `src/hooks/useScoreData.ts`: lưu điểm local và refresh leaderboard.
- `src/lib/localScores.ts`: local score storage, mock top ranking và model cho bảng xếp hạng.

## Chạy local

Yêu cầu Node.js 20+ và npm.

```bash
npm install
npm run dev
```

## Kiểm tra

```bash
npm test
npm run typecheck
npm run build
```

## Deploy

Deploy frontend như một Vite static app. Project không cần biến môi trường, auth provider, database rules hoặc emulator config.
