# Game Structure - Cấu trúc phân chia trách nhiệm

Dự án này sử dụng mô hình Component-based kết hợp với Strategy Pattern. Để giữ code dễ maintain và dễ clone, tuân thủ chặt chẽ sự phân chia sau:

## 1. Core Engine (`src/game/core.ts`)
- **Nhiệm vụ:** Pure mathematics, physics simulation, scoring, hitbox, game loop logic.
- **Quy tắc:**
  - Hoàn toàn Deterministic (dùng seeded RNG).
  - **Không** import `PixiJS`, `React`, `Firebase`, hoặc DOM API (`window`, `document`).
  - Dễ dàng unit test thông qua `core.test.ts`.

## 2. Rendering Hooks (`src/features/game/render/`)
- **Nhiệm vụ:** Đóng gói các tài nguyên PixiJS (Texture, Sprite, Particle, Ticker, Event) thành các React hooks.
- **Quy tắc:**
  - Mỗi tính năng đồ họa là một hook (`usePixiApp`, `useFruitSprites`, `useGameFeedback`).
  - Phải có hàm cleanup ở return của `useEffect` để destroy resources và gỡ event listener/ticker.
  - Nhận input từ `core.ts` state và map sang object PixiJS.

## 3. Game Components & Overlays (`src/components/game/`)
- **Nhiệm vụ:** Orchestrator (ghép nối Core và Render) và các overlay hiển thị trên Canvas.
- **Quy tắc:**
  - `FruitGame.tsx`: Chỉ đóng vai trò ghép nối. Bắt input từ DOM, gọi `core.ts` để lấy kết quả, và truyền xuống Render hooks. Không chứa logic nghiệp vụ, không gọi Firebase trực tiếp.
  - Các Overlay (`GameHud.tsx`, `GameOverOverlay.tsx`, `FloatingTextLayer.tsx`): Là React components tuyệt đối, style bằng CSS/Tailwind, hiển thị trực quan state hiện tại.

## 4. UI App Components (`src/components/ui/`)
- **Nhiệm vụ:** Chứa các phần UI bao bọc ngoài game (Loading, Landing, Header, Modal).
- **Quy tắc:** Tách biệt khỏi logic chơi game. Reusable và presentational.

## 5. Meta Hooks & Firebase (`src/hooks/`, `src/lib/`)
- **Nhiệm vụ:** Xử lý Auth (`AuthContext`), Storage (`useFirebaseStorage`), Sound (`useSound`).
- **Quy tắc:**
  - Game chạy độc lập không cần internet (Local memory state). Firebase chỉ được tương tác khi game kết thúc (Game Over) để lưu điểm.
  - Phải hỗ trợ Fallback (lưu điểm local vào session/state nếu chưa đăng nhập hoặc lỗi mạng).

---
Bằng việc tuân thủ cấu trúc này, khi cần thay đổi từ game "Chém Trái Cây" sang game "Bắn Bong Bóng" hoặc "Bắt Cá", bạn chỉ cần viết lại `core.ts` và thay đổi các Render Hooks, trong khi toàn bộ hệ thống Auth, Dashboard, Routing và UI bao ngoài được giữ nguyên.
