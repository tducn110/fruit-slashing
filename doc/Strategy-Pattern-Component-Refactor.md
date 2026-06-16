# Refactoring Audit: Strategy Pattern & Component Standardization

## Mục Đích Sửa Đổi
Tài liệu này ghi nhận quá trình chuẩn hóa codebase (Code Audit & Refactoring) nhằm giải quyết tình trạng code bị "hard-code", các giá trị cấu hình bị phân mảnh, và logic vẽ bị gom chung vào một khối lệnh `switch-case` khổng lồ. Việc tái cấu trúc này giúp mã nguồn tuân thủ nguyên tắc **Strategy Pattern**, dễ dàng bảo trì và mở rộng trong tương lai.

## Các Vấn Đề Đã Giải Quyết (Code Smells)
1. **Vi Phạm Open/Closed Principle**: Trước đây, file `fruit-utils.ts` sử dụng một khối lệnh `switch (kind)` rất lớn bên trong `makeFruit()`. Mỗi khi thêm một trái cây mới, lập trình viên phải tìm và sửa nhiều nơi (COLORS, POINTS, RADIUS, và case vẽ).
2. **Thiếu tính đóng gói (Encapsulation)**: Thuộc tính của một thực thể (điểm, màu sắc, bán kính, cách vẽ) bị rải rác ở 4-5 biến/hằng số khác nhau.
3. **Sự phụ thuộc vòng lặp**: Game Loop (`tick()`) trước đây phải chứa nhiều dòng hard-code phức tạp liên quan đến chỉ số và hành vi của trái cây.

## Giải Pháp Tái Cấu Trúc (The Solution)

### 1. Định nghĩa `FruitConfig` Interface
Tạo một Interface đại diện cho chiến lược (Strategy) của bất kỳ loại quả nào trong game.
```typescript
export interface FruitConfig {
  points: number;
  radius: number;
  colors: { body: number; edge: number; flesh: number };
  drawFull: (g: Graphics, r: number, colors: { body: number; edge: number; flesh: number }) => void;
  drawHalf: (g: Graphics, r: number, colors: { body: number; edge: number; flesh: number }, side: "left" | "right") => void;
}
```

### 2. Triển khai `FRUIT_REGISTRY`
Toàn bộ logic vẽ và cấu hình của từng trái cây được gom chung vào một kho đăng ký (Registry). Ví dụ:
```typescript
export const FRUIT_REGISTRY: Record<FruitKind, FruitConfig> = {
  banana: {
    points: 2,
    radius: 34,
    colors: { body: 0xf5c842, edge: 0xb89020, flesh: 0xfff099 },
    drawFull: (g, r, c) => { /* logic vẽ chuối */ },
    drawHalf: defaultDrawHalf
  },
  // Các loại quả khác...
};
```
Mỗi trái cây nay là một "Component" độc lập. Thêm mới một trái cây chỉ cần khai báo một object chuẩn vào Registry này.

### 3. Đơn giản hóa hàm Factory
Hàm `makeFruit` giờ đây không cần quan tâm trái cây đó là gì, nó chỉ gọi `drawFull` của chiến lược tương ứng:
```typescript
export function makeFruit(kind: FruitKind, r: number): Graphics {
  const g = new Graphics();
  const config = FRUIT_REGISTRY[kind];
  if (config) config.drawFull(g, r, config.colors);
  return g;
}
```

## Kết Luận
Việc chuẩn hóa cấu trúc đã giúp codebase tách bạch rõ ràng giữa **Dữ liệu / Cấu hình** (Data/Config) và **Logic thực thi** (Execution Logic). Cấu trúc "Component-based Strategy Pattern" mới cho phép mở rộng không giới hạn các loại trái cây mới mà không lo phá vỡ các phần code đang hoạt động ổn định.
