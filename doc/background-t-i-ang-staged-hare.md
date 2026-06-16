# Plan: Chuyển từ scroll sang page-based navigation

## Context
Hiện tại click "Chơi ngay" ở HeroSection sẽ smooth-scroll xuống section `#choi-game`. Người dùng muốn thay đổi: bấm nút sẽ **chuyển hẳn sang màn chơi game** (full-screen view), không cuộn trang. Màn game có 3 nút nổi: **Settings**, **Dashboard**, và nút quay lại Home.

## Approach

### 1. Thêm `view` state vào App.tsx
```ts
const [view, setView] = useState<"landing" | "game">("landing");
```
- `"landing"` → render layout hiện tại (TopNav + HeroSection + DashboardSection + CharactersSection + Footer), **bỏ FruitGame section**.
- `"game"` → render `GamePage` full-screen, ẩn hoàn toàn landing.

### 2. Tạo component `GamePage.tsx` (`src/app/components/GamePage.tsx`)
Full-screen wrapper chứa:
- `FruitGame` canvas (chiếm toàn bộ màn hình)
- Overlay 3 nút góc trên:
  - **🏠 Về trang chủ** → `onHome()` → set view = "landing"
  - **⚙️ Settings** → mở `SettingsModal` (toggle mute, hiển thị best score)
  - **🏆 Dashboard** → mở `DashboardModal` (bảng xếp hạng inline, tái dùng nội dung DashboardSection)
- HUD điểm / mạng đã có sẵn bên trong FruitGame (HTML overlay) không cần thay đổi

Layout nút: fixed top-right, dạng icon button row, z-index cao hơn canvas.

### 3. Tạo `SettingsModal.tsx` và `DashboardModal.tsx` (hoặc inline trong GamePage)
Vì đơn giản, dùng inline `<dialog>` hoặc div overlay trong GamePage, không cần tạo file riêng — tránh over-engineering.

**Settings panel** (toggle overlay):
- Toggle Mute (wire `muted` prop)
- Hiển thị best score

**Dashboard panel** (toggle overlay):
- Tái sử dụng data/logic từ DashboardSection, render bảng leaderboard trong overlay

### 4. Sửa App.tsx
- Xoá FruitGame section khỏi landing scroll layout
- `playClick` → `setView("game")` thay vì `handleNav("choi-game")`
- Bỏ scroll tracking cho `choi-game` (section đó không còn tồn tại)
- Truyền props cần thiết vào `GamePage`: `muted`, `onToggleMute`, `user`, `history`, `bestScore`, `lastScore`, `onGameOver`, `onHome`

### 5. Sửa HeroSection
Không cần thay đổi — `onPlay` prop vẫn giữ nguyên interface.

### 6. Đổi loại quả trong FruitGame.tsx
Thay bộ quả hiện tại bằng các loại đặc trưng Việt Nam hơn:

| Cũ | Mới | Điểm |
|---|---|---|
| peanut (đậu phộng) | **sầu riêng** (durian) | 5 — hiếm, điểm cao |
| coconut (dừa) | **vải thiều** (lychee) | 3 |
| banana (chuối) | **chuối** (giữ, rất VN) | 2 |
| dragonfruit (thanh long) | **thanh long** (giữ) | 4 |
| starfruit (khế) | **xoài** (mango) | 2 |
| bomb | **bomb** (giữ nguyên) | — |

Vẽ lại Graphics cho từng loại mới trong `makeFruit()`:
- **sầu riêng**: hình oval gai nhọn màu xanh-vàng, texture gai bằng `lineTo`
- **vải thiều**: hình tròn nhỏ màu đỏ tươi, vỏ sần bằng các dot nhỏ
- **xoài**: hình oval nghiêng màu vàng-xanh, bóng highlight

Cập nhật `COLORS`, `POINTS`, `FRUIT_KINDS` và hàm `makeFruit()` trong `FruitGame.tsx`.

## Files to modify
- `src/app/App.tsx` — thêm `view` state, điều kiện render, sửa `playClick`
- `src/app/components/HeroSection.tsx` — không đổi (optional: ẩn "Gặp Bộ Lạc" button khi không cần)

## Files to create
- `src/app/components/GamePage.tsx` — full-screen game view với 3 nút overlay

## Verification
1. Click "Chơi ngay" → trang chuyển sang màn game full-screen (không scroll)
2. 3 nút hiển thị ở góc trên: Home, Settings, Dashboard
3. Settings toggle mute hoạt động
4. Dashboard hiện bảng xếp hạng
5. Nút Home quay về landing page
6. Game over → điểm được lưu, có thể xem ở Dashboard
