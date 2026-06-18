# Chém Lạc

Web game chém trái cây xây bằng React, Vite và PixiJS v8. Firebase Authentication quản lý tài khoản; leaderboard chỉ nhận điểm được Firebase Functions xác minh bằng deterministic replay.

## Kiến trúc

- `src/game/core.ts`: game state thuần, seeded RNG, fixed-step physics, scoring và replay validation.
- `FruitGame.tsx`: PixiJS renderer, input sampling và hiệu ứng; không tự quyết định điểm.
- `useFirebaseStorage.ts`: bắt đầu verified session, gửi replay và đọc leaderboard.
- `functions/src/index.ts`: callable `startGame`/`submitGame`, replay server-side và transaction ghi Firestore.
- `firestore.rules`: client chỉ được đọc leaderboard và đọc stats của chính mình; mọi score write đi qua Admin SDK.

Người chơi chưa đăng nhập vẫn chơi đầy đủ nhưng điểm chỉ tồn tại trong phiên và không được xếp hạng.

## Chạy local

Yêu cầu Node.js 20+, npm và Java 21+ nếu chạy Firebase Emulator.

```bash
npm install
npm --prefix functions install
cp .env.example .env
npm run dev
```

Các biến `VITE_FIREBASE_*` lấy từ Firebase Web App. Production bắt buộc cấu hình `VITE_FIREBASE_APP_CHECK_SITE_KEY` bằng reCAPTCHA v3 và bật enforcement cho callable Functions.

## Kiểm tra

```bash
npm test
npm run typecheck
npm run build
npm --prefix functions run typecheck
npm --prefix functions run build
npm run test:rules
```

`test:rules` khởi động Firestore Emulator và không kết nối project production.

## Deploy

1. Bật Blaze plan, Authentication providers, Firestore, Functions và App Check trong project `fruit-games-79f91`. Với replay protection, cấp role `Firebase App Check Token Verifier` cho service account của Functions.
2. Deploy backend trước: `firebase deploy --only functions,firestore`.
3. Xóa leaderboard cũ một lần bằng service account/ADC:

```bash
npm --prefix functions run reset:leaderboard -- fruit-games-79f91 --confirm-delete
```

4. Deploy frontend lên Vercel sau khi backend và rules đã hoạt động.

Script reset yêu cầu đúng project ID và cờ xác nhận; nó xóa `runs`, `gameSessions` và đưa thống kê user về 0.
