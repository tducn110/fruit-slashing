# Tổng Hợp Lịch Sử Refactor (Code Audit & Optimization)
*Dự án: Speed Click Game (React + PixiJS)*

Tài liệu này ghi chú lại toàn bộ các bước tái cấu trúc (Refactoring), tối ưu hóa hiệu năng và thiết kế lại kiến trúc mã nguồn từ đầu phiên làm việc đến hiện tại.

---

## 1. Nạp Kỹ Năng & Phân Tích Hiện Trạng
- **Thu thập tài nguyên:** Phát hiện bộ PixiJS Skills được đính kèm cục bộ trong `node_modules/pixi.js/skills`. Đã thực hiện sao chép chúng sang thư mục hệ thống `~/.codex/skills` để AI nắm vững kiến thức về Pixi v8.
- **Phân tích:** Nhận thấy `FruitGame.tsx` chưa tối ưu WebGL (Render Background tĩnh liên tục), nhiều biến `radius`, `colors` bị hard-code (gắn cứng) lặp lại nhiều nơi, và logic vật lý thiếu ràng buộc khung hình khiến hoa quả dễ bay văng ra ngoài mép màn hình.

## 2. Giai Đoạn 1: Tối Ưu Hiệu Năng & Vá Lỗi Vật Lý
- **Tối ưu WebGL Background:** Cập nhật hàm render `drawBackground` trong `FruitGame.tsx`. Thay vì Push toàn bộ `Graphics` vector (núi, đồi, chim) vào `Container` khiến CPU phải tính toán lại mỗi khung hình, hệ thống đã chuyển sang **Render-to-Texture** (`app.renderer.generateTexture`) và bọc lại vào một `Sprite` duy nhất.
- **Ràng buộc màn hình (Screen Bounds):** Bổ sung logic vật lý dội ngược (Bounce) cho trục X. Nếu hoa quả (`f.g.x`) hoặc hạt văng (`p.g.x`) chạm vào lề 0 hoặc `Width` của màn hình, lực `vx` sẽ bị đảo ngược `vx *= -1`, đảm bảo 100% không có vật thể nào lọt ra ngoài camera.
- **Xóa Magic Numbers:** Chuyển các chỉ số `radius` thành bảng cấu hình `RADIUS` tại `fruit-utils.ts`.

## 3. Giai Đoạn 2: Nâng Cấp Gameplay & Tận Dụng Batching
- **Tăng số lượng Particle:** Tận dụng khả năng WebGPU Batching của PixiJS v8, số lượng các mảnh vỡ (Splat) nảy ra khi chém quả được xả ra gấp 3 lần (45-60 hạt) và với bom nổ là 150 hạt. Không làm sụt giảm FPS do chúng dùng chung một Texture hình tròn.
- **Độ khó nâng cao (Difficulty Scaling):**
  - Giảm thời gian chờ xuất hiện trái cây (Spawn cooldown) dựa theo điểm.
  - Hoa quả bay nhanh hơn.
  - Tỉ lệ rớt Bom tăng mạnh.
  - **Cơ chế Spawn Wave:** Cứ đạt mỗi mốc 40 điểm, game sẽ tung nhiều hoa quả cùng **một lúc** thay vì từng quả một (Tối đa 4 quả/lượt), đẩy nhanh nhịp độ trò chơi.

## 4. Giai Đoạn 3: Chuẩn Hóa Kiến Trúc theo Strategy Pattern
Dựa trên triết lý "Mở rộng Component", hệ thống đã loại bỏ hoàn toàn khối lệnh `switch(kind)` khổng lồ trong file `fruit-utils.ts`.
- **Áp dụng Design Pattern:** Chuyển đổi thành **Strategy Pattern** thông qua một `FRUIT_REGISTRY`. 
- **Lợi ích:** Bây giờ, một loại trái cây tự mang trong mình cấu hình trọn gói: Điểm số, Bán kính, Màu sắc, Logic Vẽ Khối (`drawFull`) và Vẽ Cắt Nửa (`drawHalf`). 
- **Tương lai:** Việc thêm dưa hấu, dứa hay bất kỳ trái cây nào chỉ tốn 10 giây khai báo Object mới vào Registry, không làm ảnh hưởng đến mã nguồn gốc.

## 5. Giai Đoạn 4: Quy Hoạch Tài Liệu (Documentation)
Hệ thống đã kết xuất ra các tài liệu chuẩn bị cho quá trình mở rộng tiếp theo:
1. `doc/Strategy-Pattern-Component-Refactor.md`: Chi tiết về cách refactor kiến trúc component trái cây.
2. `doc/auth.md`: Kế hoạch chuyển đổi từ `localStorage` sang Cloud Storage bằng **Google Firebase Authentication & Firestore**.
3. `doc/design.md`: Hướng dẫn kiến trúc tổng thể toàn dự án và kế hoạch cải tiến độ phản hồi vật lý (Click Responsiveness) cho các thẻ và nút bấm UI của React (Ripple effects, CSS Scale).

---
*Tất cả những thay đổi trên đã được tích hợp ổn định và sẵn sàng cho các phase phát triển tính năng mới tiếp theo.*
