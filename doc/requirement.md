# Software Requirements Specification (SRS)
*Dự án: Speed Click Game (Tích hợp Bộ Lạc Đậu Phộng & Wink Platform)*

Tài liệu này phân tích chi tiết các yêu cầu nghiệp vụ và kỹ thuật mới nhất, làm kim chỉ nam cho quá trình phát triển tiếp theo của dự án.

---

## 1. Yêu cầu Gameplay (Core Mechanics)
**1.1. Thời lượng chơi (Time Limit):**
- Mỗi ván chơi kéo dài chính xác **3 phút (180 giây)**.
- **UI:** Cần bổ sung đồng hồ đếm ngược (Countdown Timer) hiển thị rõ ràng trên màn hình khi đang trong `GamePage`.
- **Kết thúc (Game Over):** Khi hết 3 phút, trò chơi tự động dừng việc spawn mục tiêu mới. Tính toán tổng điểm dựa trên số lượng mục tiêu chém trúng và hệ số Combo.
- **Xếp hạng (Ranking):** Sau khi kết thúc, hiển thị kết quả bao gồm: Điểm số, Xếp hạng (Rank) dựa trên các mốc điểm, và tự động lưu vào hệ thống lịch sử.

## 2. Hệ thống Tài khoản & Tích hợp (Authentication)
**2.1. Đăng nhập Google (Giai đoạn hiện tại):**
- Tích hợp **Firebase Authentication** để cho phép người dùng đăng nhập nhanh bằng tài khoản Google.
- Lưu trữ điểm số (Score) và thông tin người chơi (Tên, Avatar) lên **Cloud Firestore** để phục vụ Bảng Xếp Hạng toàn cầu (Global Leaderboard).

**2.2. Tích hợp Wink Platform (Tương lai):**
- **Nền tảng đích:** [Wink Games](https://winkgames.papastudio.net/).
- **Cơ chế:** Khi game được nhúng/tích hợp vào Wink, cơ chế đăng nhập sẽ được đồng bộ. Hệ thống cần được thiết kế lỏng (Decoupled Auth Module) để có thể nhận `Token` hoặc thông tin User từ nền tảng Wink truyền sang (thông qua postMessage API, OAuth, hoặc SDK nội bộ của Papastudio).
- **Đồng bộ hóa:** Điểm số và thành tích (Achievements) có thể được đẩy ngược lại hệ thống dữ liệu của Wink để ghi nhận cho tài khoản người dùng bên đó.

## 3. Định hướng Đồ họa & Âm thanh (Art Direction)
Toàn bộ phong cách thiết kế, giao diện, đồ họa in-game và âm thanh phải tuân thủ nghiêm ngặt nhận diện thương hiệu của **Bộ Lạc Đậu Phộng** ([bolacdauphong.vn](https://bolacdauphong.vn/)).

**3.1. Hình ảnh (Graphics & Background):**
- **Nhân vật & Mục tiêu:** Thay thế các loại hoa quả cơ bản bằng hình ảnh đặc trưng của Bộ Lạc Đậu Phộng (Ví dụ: Nhân vật Lạc Lạc, Mèo Phở, các hạt đậu phộng vàng, vật phẩm đặc trưng).
- **Background:** Cảnh nền của game phải lấy cảm hứng từ thế giới của Bộ Lạc Đậu Phộng (đồng quê, làng mạc, gam màu vàng, nâu, cam ấm áp).
- **UI Elements:** Nút bấm, bảng xếp hạng, viền màn hình mang phong cách hoạt hình, mộc mạc (Rustic/Cartoonish) phù hợp với website chính.

**3.2. Âm thanh (Audio):**
- **BGM (Nhạc nền):** Vui tươi, nhộn nhịp, mang hơi hướng làng quê/bộ lạc.
- **SFX (Hiệu ứng âm thanh):** 
  - Tiếng chém trúng vật phẩm (Slashing sound).
  - Tiếng lồng tiếng ngắn của các nhân vật Bộ Lạc khi đạt combo cao hoặc lỡ nổ bom.
  - Tiếng UI tick, hover và nổ bom rộn ràng.

## 4. Công nghệ triển khai (Tech Stack)
- **Game Engine:** **PixiJS** (Đảm nhiệm Canvas, Rendering 60FPS, Sprite Batching, Logic Vật lý và Vòng lặp Game).
- **UI & Trạng thái:** **React + Vite** (Đảm nhiệm các Overlay, Menu, HUD, Popup Đăng nhập, Bảng xếp hạng).
- **Database/Auth:** **Firebase** (Firestore & Auth) để xử lý logic Backend tạm thời trước khi cắm vào hệ thống API của Wink.
- **Architecture:** Tiếp tục duy trì và mở rộng cấu trúc **Component-based Strategy Pattern** đã được chuẩn hóa để dễ dàng cấu hình thêm các loại mục tiêu/nhân vật mới từ Bộ Lạc Đậu Phộng.
