# Migration Checklist - Clone Game Template

Khi sử dụng template này (React + PixiJS + Firebase) để clone sang một mini-game mới, hãy thực hiện theo các bước sau để đảm bảo không phá vỡ kiến trúc. Đưa file này cho AI Agent đọc để nó biết cần làm gì.

## 1. Assets & Theme (Thiết kế đồ họa & Âm thanh)
- [ ] Cập nhật toàn bộ file trong thư mục `public/assets/` (BGM, SFX, Loading SVG, background).
- [ ] Chỉnh sửa `src/styles/theme.css` để thay đổi hệ màu (`--primary`, `--rice-paper`, v.v.), font chữ và các biến UI.
- [ ] Thay đổi nội dung tĩnh trong `src/components/ui/` như `HeroSection.tsx`, `TopNav.tsx` (Logo, Title, Text CTA).
- [ ] Thay đổi background trong PixiJS (`drawBackground` trong `fruit-utils.ts` hoặc hook đồ họa thay thế).

## 2. PixiJS Rendering & Effects (Visuals)
- [ ] Thay thế hoặc chỉnh sửa các hàm tạo hình (`makeFruit`, `makeHalf`) trong `src/utils/fruit-utils.ts` (có thể dùng sprite từ file ảnh thay vì vẽ bằng code nếu game phức tạp hơn).
- [ ] Cập nhật `useParticleSystem` và `useSliceEffects` (hoặc các effect tương tự) để phù hợp với action chính của game mới.
- [ ] Tuỳ chỉnh `FloatingTextLayer` và các animation feedback trong `useGameFeedback`.

## 3. Game Engine (Core Gameplay)
- [ ] Cập nhật hằng số trong `src/game/core.ts` (`GAME_DURATION_MS`, `WORLD_WIDTH`, `WORLD_HEIGHT`).
- [ ] Định nghĩa lại `GameState`, `CoreFruit` (đổi tên cho phù hợp context), và các rules (`FRUIT_RULES`).
- [ ] Thay đổi cơ chế tính toán vật lý (Gravity, Speed) và hàm `spawnFruit` trong `core.ts`.
- [ ] Thay đổi logic va chạm (`applyInput`) và cách tính điểm, combo.

## 4. UI Overlays (HUD & State)
- [ ] Cập nhật `GameHud.tsx` để hiển thị các chỉ số mới (máu, thời gian, combo, energy).
- [ ] Đổi rank text trong `rankFor` (`core.ts`) và điều chỉnh UI `DashboardPanel.tsx`.
- [ ] Thay đổi giao diện `GameOverOverlay.tsx` để phản ánh đúng phần thưởng và thông điệp.

## 5. Firebase & Backend (Tuỳ chọn)
- [ ] Cập nhật `firebase.ts` hoặc `.env` với các key mới của project Firebase đích.
- [ ] Thay đổi `firestore.rules` nếu game mới có cấu trúc lưu điểm/userdata khác.
- [ ] Đổi tên Firebase collections (nếu cần thiết) trong `useFirebaseStorage.ts`.

> **Lưu ý cho AI Agent:** Khi clone, tuyệt đối giữ nguyên mô hình Orchestrator tại `FruitGame.tsx` và separation of concerns giữa `core.ts` (Pure math/logic) và React (Auth, State, UI).
