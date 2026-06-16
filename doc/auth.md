# Firebase Integration & Storage Strategy

## 1. Hiện Trạng Storage
Hiện tại, logic lưu trữ của game đang sử dụng `localStorage` thông qua custom hook `useGameStorage.ts`. Các thông số bao gồm `blp_user`, `blp_history`, `blp_best` được lưu tĩnh trên trình duyệt.
**Nhược điểm:**
- Mất dữ liệu khi người dùng đổi trình duyệt hoặc xóa cache.
- Không có bảng xếp hạng (Leaderboard) toàn cầu.
- Định danh người dùng lỏng lẻo (chỉ cần nhập tên).

## 2. Lộ trình tích hợp Google Firebase

Để nâng cấp dự án thành một Web Game thực thụ có khả năng kết nối nhiều người chơi, chúng ta sẽ chuyển đổi kiến trúc Storage sang **Firebase Authentication** và **Cloud Firestore**.

### a) Firebase Authentication (Đăng nhập Google)
Thay vì dùng `LoginModal` hiện tại để người chơi tự gõ tên, ta tích hợp popup đăng nhập Google.
- **Package:** `firebase/auth`
- **Phương thức:** `signInWithPopup(auth, new GoogleAuthProvider())`
- **Lợi ích:** Xác thực người chơi thật, lấy được Avatar và Email (tránh spam tên giả).

### b) Database Schema (Cloud Firestore)
Ta sẽ cấu trúc Database NoSQL như sau:

**Collection: `users`**
- `uid` (Document ID)
- `displayName`: string
- `photoURL`: string
- `bestScore`: number
- `totalGamesPlayed`: number
- `createdAt`: timestamp

**Collection: `runs` (Lịch sử các ván chơi)**
- `runId` (Document ID)
- `uid`: string (Reference to users)
- `playerName`: string (Snapshot name for quick UI render)
- `score`: number
- `combo`: number
- `timestamp`: timestamp

### c) Cập nhật hook `useGameStorage`
Tái cấu trúc hook hiện tại để đồng bộ với Firebase:
1. Sử dụng `onAuthStateChanged` để lắng nghe trạng thái đăng nhập.
2. `saveRun()`: Đẩy document mới lên collection `runs` thay vì `localStorage`, đồng thời kiểm tra và update `bestScore` của user trên `users`.
3. Thay vì chỉ hiển thị `history` cá nhân, Dashboard sẽ tải top 100 `runs` cao điểm nhất để tạo Global Leaderboard thông qua query `orderBy('score', 'desc').limit(10)`.

### 3. Quy trình Triển khai (Next Steps)
1. Cài đặt Firebase SDK: `npm install firebase`.
2. Tạo file `src/app/config/firebase.ts` để khởi tạo `initializeApp`.
3. Bật Firebase Auth (Google Provider) và Firestore DB trong Firebase Console.
4. Viết lại `useGameStorage.ts` thành `useFirebaseAuth.ts` và `useFirestore.ts` để bóc tách rõ ràng.
