# System Design

## Runtime

React quản lý navigation, authentication, dashboard và modal. PixiJS v8 chỉ render canvas và hiệu ứng. `src/game/core.ts` là nguồn sự thật duy nhất cho spawn, physics, hit detection, combo, lives, timer và score.

Game core chạy fixed-step 60 Hz trong logical world `1000x600`. RNG có seed do server cấp. Pointer được chuẩn hóa về `0..10000`, lấy tối đa 30 mẫu/giây và gắn tick; cùng input log tạo ra cùng kết quả trên browser và Firebase Function.

## Verified Game Flow

1. User đã đăng nhập gọi `startGame`; Function tạo `gameSessions/{uid}` với seed, session ID và expiry.
2. Client chạy core bằng seed đó và thu input log. Final score từ client chỉ dùng để phản hồi UI.
3. Client gọi `submitGame` với `sessionId` và input log, không gửi score authoritative.
4. Function kiểm Auth, App Check, schema/rate/timestamp, replay game và transaction ghi run verified, user stats và trạng thái session.
5. Firestore rules cấm toàn bộ client writes vào `runs`, `users` và `gameSessions`.

Replay xác minh một input log hợp lệ theo luật game nhưng không thể ngăn bot tạo input hoàn hảo. Chống bot realtime nằm ngoài kiến trúc hiện tại.

## Guest Flow

Guest nhận seed local và dùng cùng game core. Không tạo server session, không ghi Firestore và UI ghi rõ điểm không được xếp hạng.

## Collections

- `runs/{runId}`: snapshot tên/avatar, verified score, play time và created time; public read, Admin write.
- `users/{uid}`: best score và total games; owner read, Admin write.
- `gameSessions/{uid}`: active/submitted session; client không có quyền truy cập.
