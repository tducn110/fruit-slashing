# Kiến trúc và Convention PixiJS - Speed Click Game

Tài liệu này tổng hợp cấu trúc hiện tại của codebase, cách PixiJS được tích hợp cùng React, và các nguyên tắc (rules) cần tuân thủ khi phát triển thêm tính năng để duy trì chất lượng mã nguồn.

## 1. Cách dự án đang sử dụng PixiJS

* **App lifecycle và cleanup:**
  * Application PixiJS được khởi tạo thông qua hook `usePixiApp` và được gắn vào DOM thông qua `FruitGame.tsx`.
  * Lifecycle của PixiJS được gắn chặt với lifecycle của component React `FruitGame`.
  * **Cleanup:** Tại hàm `return` của `useEffect` trong `FruitGame.tsx`, mọi listener (`pointermove`, `pointerdown`), Ticker (`app.ticker.remove`), ResizeObserver, và các resource như sprites (`clearFruitSprites`), particles (`clearParticles`) đều được dọn dẹp cẩn thận để tránh memory leak.

* **Quản lý Texture/Sprite/Particle/Ticker/Pointer:**
  * **Texture & Sprite:** Được quản lý tách biệt qua các hook chuyên dụng `useFruitTextures` (load và cache ảnh) và `useFruitSprites` (đồng bộ trạng thái game core thành object render).
  * **Particle & Feedback:** Được tách ra các hook riêng biệt như `useParticleSystem` (cập nhật bụi/tia lửa), `useGameFeedback` (rung màn hình, flash đỏ) và `useSliceEffects`.
  * **Ticker:** Ticker của PixiJS điều phối vòng lặp chính của rendering, gọi `advanceToTick` để cập nhật logic physics, sau đó gọi update các hooks đồ họa và cập nhật UI (HUD) một cách có kiểm soát (`ticker.lastTime % 250 < ticker.deltaMS`).
  * **Pointer listener:** Bắt sự kiện trực tiếp từ `app.canvas.addEventListener` (để tối ưu hiệu suất thay vì dùng sự kiện của React). Tọa độ màn hình được scale và normalize sang tọa độ thế giới (World Coordinate) để xử lý logic chém.

* **Phân chia trách nhiệm React và PixiJS:**
  * **React:** Đảm nhận state routing, xác thực (Auth), lưu điểm (Firebase), logic các màn hình (Landing, Loading), các overlay UI (HUD, Countdown, Game Over) và lắng nghe thao tác menu.
  * **PixiJS:** Thuần túy chịu trách nhiệm hiển thị high-performance rendering trên Canvas (vẽ trái cây, vẽ đường chém, hiệu ứng hạt, rung màn hình) và bắt input liên tục với độ trễ thấp.

* **Rules khi thêm logic PixiJS mới:**
  * Không đưa logic vật lý/gameplay vào file liên quan đến PixiJS.
  * Mọi resource đồ họa mới phải được đóng gói vào một hook riêng biệt theo pattern `useFeatureName` (vd: `useFruitSprites`) và bắt buộc phải export hàm clear/cleanup.

## 2. Cách phân bổ component trong dự án

* **Component thuộc UI React (`src/components/ui/`):** 
  * Chứa các thành phần giao diện truyền thống: `HeroSection.tsx`, `TopNav.tsx`, `LoadingScreen.tsx`, `LoginModal.tsx`.
  
* **Component là Overlay Game (`src/components/game/`):**
  * Hiển thị đè lên trên Canvas: `GameHud.tsx` (Điểm, Combo, Thời gian), `CountdownOverlay.tsx` (Đếm ngược 3,2,1), `GameOverOverlay.tsx` (Màn hình tổng kết), `FloatingTextLayer.tsx` (Hiệu ứng text nổi + điểm).
  * `DashboardPanel.tsx`, `SettingsPanel.tsx` (Các panel chức năng pop-up trên game).
  * `FruitGame.tsx` là component chứa logic PixiJS và mount canvas. `GamePage.tsx` là trang bọc ngoài, điều hướng các panel và sound.

* **Hook quản lý Renderer/Gameplay/Feedback (`src/features/game/render/` và `src/hooks/`):**
  * Render: `usePixiApp`, `useFruitTextures`, `useFruitSprites`, `useParticleSystem`, `useGameFeedback`, `useSliceEffects`.
  * Gameplay & Meta: `useScoreData.ts` (Firebase leaderboard & points), `useSound.ts` (Audio BGM & SFX).

* **Phân chia logic và render:**
  * **Logic thuần:** `src/game/core.ts` chứa toàn bộ công thức vật lý, tọa độ, điểm số, và phát sinh (spawn) đối tượng. File này không được phép import bất kỳ thư viện render nào.
  * **Render UI:** Các hooks và overlay React.

* **Boundaries không nên phá vỡ:**
  * `core.ts` tuyệt đối không được truy cập `window`, `document`, hay `PixiJS`.
  * React hooks không được trực tiếp thay đổi các thông số `vx`, `vy`, `x`, `y` của đối tượng game mà phải gọi hàm từ `core.ts` (ví dụ: `applyInput`).

## 3. Những convention nên viết thành rules (Custom Instructions)

* **Rule về PixiJS lifecycle và cleanup:** 
  * "Khi tạo một hook/component PixiJS mới, BẮT BUỘC phải return một hàm cleanup trong `useEffect` để gỡ bỏ ticker, event listeners, huỷ tham chiếu đồ họa và destroy textures nếu cần thiết. Không được bỏ qua bước chống memory leak."

* **Rule về component structure:** 
  * "Giữ phân tách nghiêm ngặt: UI tĩnh vào `src/components/ui/`, UI đè lên game vào `src/components/game/`, logic render PixiJS vào `src/features/game/render/`. File `core.ts` chỉ chứa logic toán học/vật lý."
  * "FruitGame chỉ được làm orchestrator: nối core + Pixi hooks + overlay. Không thêm gameplay rule, Firebase, auth, leaderboard hoặc design logic mới vào FruitGame."

* **Rule về CSS/Styles:** 
  * "CSS/CSS Modules dùng cho game-specific UI, overlay, animation và canvas wrapper. Tailwind nếu có thì chỉ dùng cho layout/spacing/typography đơn giản. Không style cùng một property bằng cả Tailwind và CSS module trên cùng element."

* **Rule về game state, Firebase và local fallback:** 
  * "Trạng thái in-game chạy hoàn toàn ở memory client. Chỉ tương tác với Firebase khi trò chơi kết thúc (Game Over). BẮT BUỘC phải xử lý fallback mượt mà nếu lưu điểm thất bại (`saveError`), không làm gián đoạn trải nghiệm người chơi."

* **Rule về responsive desktop/mobile:** 
  * "Không hardcode kích thước pixel cố định cho gameplay. Luôn sử dụng `WORLD_WIDTH` và `WORLD_HEIGHT` trong `core.ts`, và mapping tọa độ thông qua `screenToWorld()` với dynamic scale (`renderScale` dựa trên viewport hiện tại) qua `getGameConfig()`."

* **Rule về test khi thay đổi physics/gameplay:** 
  * "Bất kỳ thay đổi nào trong gameplay rules (trọng lực, điểm số, hitbox) phải được thực hiện trong `src/game/core.ts` và CÓ THỂ test được bằng Jest (`core.test.ts`) mà không cần mount DOM hay load thư viện canvas đồ họa."
