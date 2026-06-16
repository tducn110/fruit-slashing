# System Design & UI Interaction Document
Project: Speed Click Game (PixiJS + React)

## 1. Kiến Trúc Toàn Dự Án (Project Architecture)
Dự án là một sự kết hợp giữa hệ sinh thái **React** (quản lý trạng thái, UI Navigation, Layout) và **PixiJS** (quản lý Game Loop, Rendering WebGL, Physics).
*   **Vite + React (Frontend Framework)**: Cung cấp môi trường dev siêu tốc, HMR, và dựng các layout bên ngoài game.
*   **PixiJS v8 (Game Engine)**: Dựng một Canvas độc lập chạy bên trong component `FruitGame.tsx`. Xử lý các logic vật lý, batch rendering và tương tác chuột (Pointer Events).

## 2. Cấu Trúc Components
Các giao diện bao quanh game được chia nhỏ thành các Component độc lập trong `src/app/components`:
1.  `TopNav.tsx`: Chứa Menu điều hướng (`active` spy scrolling) và nút Đăng Nhập.
2.  `HeroSection.tsx`: Màn hình giới thiệu ban đầu với nút Call-to-action (Bắt Đầu).
3.  `GamePage.tsx` & `FruitGame.tsx`: Lớp bọc Game, nơi gắn Canvas PixiJS.
4.  `DashboardSection.tsx`: Hiển thị thông số (Thành tích cao nhất, Lịch sử chơi).
5.  `Footer.tsx`: Cung cấp thông tin liên hệ / bản quyền.
6.  `LoginModal.tsx`: Popup Overlay để người dùng thiết lập danh tính.

## 3. UI/UX: Cải Thiện Độ Phản Hồi Khi Bấm (Click Responsiveness)
Theo ghi nhận, **nhiều components hiện tại khi bấm vào chưa mang lại cảm giác responsive**. Các nút bấm, thẻ bài (Card) thiếu các phản hồi vi mô (micro-interactions), gây cảm giác game bị đơ hoặc chạm không ăn. 

### a) Vấn đề
- Các nút (Button) trong Navigation, HeroSection và LoginModal chưa có hiệu ứng lún (scale down) khi click (`:active`).
- Chưa có hiệu ứng âm thanh nhỏ (SFX) xác nhận hành động click.
- Hover state quá cơ bản (chỉ đổi màu nhẹ), chưa thu hút sự chú ý.

### b) Ý Tưởng & Giải Pháp Triển Khai
Để game mang lại cảm giác "đã tay" ngay cả ở ngoài màn hình chơi, ta sẽ áp dụng các chuẩn sau:

1. **Active Transform (Hiệu ứng nhún)**
   Tất cả các thẻ `<button>` và thẻ tương tác (Card trong Dashboard) phải có thuộc tính CSS:
   ```css
   button {
     transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease;
   }
   button:active {
     transform: scale(0.95); /* Thu nhỏ 5% khi nhấn */
   }
   button:hover {
     transform: scale(1.02); /* Phình to nhẹ khi di chuột */
   }
   ```

2. **Ripple Effect (Hiệu ứng lan tỏa mặt nước)**
   Cài đặt hoặc tự viết một hook tạo hiệu ứng gợn sóng khi người dùng touch/click vào bề mặt button, đặc biệt ở nút "Bắt đầu chém" và "Chơi lại". Nó cung cấp phản hồi thị giác ngay lập tức ở đúng tọa độ trỏ chuột.

3. **Cải tiến trong Game (PixiJS)**
   Ngay khi chém trúng hoa quả, thay vì chỉ lóe màu (Particle), màn hình có thể có hiệu ứng **Camera Shake** (rung nhẹ khung hình) trong vài mili-giây đối với các quả Bom, hoặc làm sáng lóe (White Flash) toàn màn hình khi nổ Bom.

4. **Âm Thanh (Sound Feedback)**
   Tích hợp gói âm thanh ngắn (UI sounds):
   - `hover.mp3`: Khi lướt chuột qua menu.
   - `click.mp3`: Khi xác nhận Login, Bấm chơi lại.
   - Trải nghiệm sẽ hoàn thiện hơn và không còn cảm giác bị "hẫng" khi tương tác.
