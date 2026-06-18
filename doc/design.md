# System Design

## Runtime

React quản lý navigation, authentication, dashboard và modal. PixiJS v8 chỉ render canvas và hiệu ứng. `src/game/core.ts` là nguồn sự thật duy nhất cho spawn, physics, hit detection, combo, lives, timer và score.

Game core chạy fixed-step 60 Hz trong logical world `1000x600`. RNG có seed local. Pointer được chuẩn hóa về `0..10000`, lấy tối đa 30 mẫu/giây và gắn tick để core giữ kết quả ổn định trên browser.

## Minimal Score Flow

1. Client chạy game và giữ score local trong phiên.
2. Khi game over, client gửi `score` qua callable Function nếu user đã đăng nhập.
3. Function kiểm Auth, giới hạn score hợp lý và ghi `runs` cùng `users` qua Admin SDK.
4. Firestore rules cấm toàn bộ client writes vào `runs` và `users`.

## Guest Flow

Guest nhận seed local và dùng cùng game core. Không ghi Firestore và UI ghi rõ điểm không được xếp hạng.

## Collections

- `runs/{runId}`: snapshot tên/avatar, score, play time và created time; public read, Admin write.
- `users/{uid}`: best score và total games; owner read, Admin write.
