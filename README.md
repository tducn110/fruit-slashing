# Chém Lạc

Web game chém trái cây xây bằng React, Vite và PixiJS v8. Firebase Authentication quản lý tài khoản; leaderboard lưu trực tiếp trong Firestore cho người chơi đã đăng nhập.

## Kiến trúc

- `src/game/core.ts`: game state thuần, seeded RNG, fixed-step physics và scoring.
- `FruitGame.tsx`: PixiJS renderer, input sampling và hiệu ứng; không tự quyết định điểm.
- `useScoreData.ts`: lưu điểm bằng Firestore transaction và đọc leaderboard.
- `firestore.rules`: chỉ tài khoản đăng nhập được tạo run cho chính UID của mình; run không thể sửa hoặc xóa.

Người chơi chưa đăng nhập vẫn chơi đầy đủ nhưng điểm chỉ tồn tại trong phiên và không được xếp hạng.

## Chạy local

Yêu cầu Node.js 20+ và npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Các biến `VITE_FIREBASE_*` lấy từ Firebase Web App. Không cần App Check cho bản rút gọn này.

## Kiểm tra

```bash
npm test
npm run typecheck
npm run build
```

## Deploy

1. Bật Authentication providers và Firestore trong project `fruit-games-79f91`.
2. Deploy rules: `firebase deploy --only firestore:rules --project fruit-games-79f91`.
3. Deploy frontend lên Vercel sau khi rules đã hoạt động.

Cloud Functions không được sử dụng, nên project không cần Blaze plan.
