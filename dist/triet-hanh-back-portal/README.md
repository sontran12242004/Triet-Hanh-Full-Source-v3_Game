# Cổng quay lại map — Triết Hành

Giao diện và vị trí cổng được tách từ game đang deploy ngày 28/09/2026. Module độc lập có thêm chặn kích hoạt lặp và cooldown 0,5 giây. Không chứa cả game, map nền hoặc database.

## File

- `back-portal.js`: code ES module Canvas 2D.
- `PROMPT.md`: prompt đầy đủ để đưa vào AI/code editor khác.
- `index.html`: demo tương tác, dùng chấm tròn làm nhân vật.
- `serve.mjs`: server demo, không cần npm install.

## Chạy demo

Mở terminal trong folder, chạy `node serve.mjs`, sau đó mở http://localhost:8080. Có thể dùng VS Code Live Server. Không mở trực tiếp bằng file://.

Demo cho chọn tất cả map để test. Đây chỉ là menu demo; khi gắn vào game, giữ luật mở map của game.

## Tích hợp vào game đang có

Copy `back-portal.js` vào cùng thư mục với `game.js`. Nếu game chưa dùng ES module, đổi thẻ nạp game thành `<script type="module" src="game.js"></script>`; giữ `data.js` và `logic.js` chạy trước nó như hiện tại.

Trong `game.js`:

```js
import { BackPortal } from './back-portal.js';

const backPortal = new BackPortal({
  width: W,             // 1440
  height: H,            // 900
  mapNames: worlds.map(w => w.country),
  font: 'GameSans, system-ui, sans-serif',
  reducedMotion: reduced
});
```

Ở cuối hàm `update(dt)`, sau cập nhật tọa độ nhân vật và trước kiểm tra cổng đi tiếp:

```js
// Hàm update phải return sớm khi đang mở modal / pause / chưa ready.
if (backPortal.update({
  player,
  mapIndex: world,
  dt,
  changeMap
})) return;
```

Trong hàm `draw(t, dt)`, thêm:

```js
backPortal.draw(ctx, { mapIndex: world, time: t });
```

`t` và `dt` tính bằng GIÂY. Tọa độ `player` là vị trí chân nhân vật, dùng cùng hệ tọa độ với canvas. Màu, kích thước và vị trí cổng giống bản deploy ở kích thước 1440 × 900.

**Nếu project đã có code cổng cũ:** xóa nhánh `if (world > 0 && player.y > H * .87 ...)` trong update và khối vẽ cổng xanh `if (world > 0) {...}` trong draw trước khi tích hợp module, tránh xử lý/vẽ hai lần. Không xóa cổng vàng đi tiếp.

## Yêu cầu với changeMap

Game hiện tại đã có hàm phù hợp. Với project khác, callback phải trả `true` khi chuyển thành công, `false` khi không chuyển được. Ví dụ:

```js
function changeMap(index) {
  if (index < 0 || index >= worlds.length) return false;
  // Kiểm tra quyền mở map nếu project của bạn có.
  world = index;
  player = { x: W * .5, y: H * .82 };
  target = null;
  keys.clear();
  // Giữ nguyên answers, score, mistakes, run ID và profile.
  persist(); // Nếu game đang dùng lưu local.
  updateUI();
  return true;
}
```

Module không gọi DB hay sửa dữ liệu câu hỏi; việc giữ nguyên tiến độ phụ thuộc callback không reset dữ liệu.

## API

| Lệnh | Công dụng |
|---|---|
| `new BackPortal(options)` | Tạo cổng; cấu hình width, height, mapNames, font, reducedMotion |
| `portal.draw(ctx, {mapIndex, time})` | Vẽ cổng theo map hiện tại |
| `portal.update({player, mapIndex, dt, changeMap})` | Kiểm tra đi vào cổng; trả true nếu đã chuyển map |
| `portal.contains(player, mapIndex)` | Kiểm tra vùng chạm |
| `portal.isVisible(mapIndex)` | Map hiện tại có cổng quay lại không |
| `portal.position` | Tâm cổng |
| `portal.spawnPoint` | Điểm xuất hiện an toàn sau chuyển map |
| `portal.reducedMotion = true` | Dừng nhịp co giãn của cổng |

Giữ instance cổng trong suốt vòng đời màn game; không tạo lại mỗi frame. Module không tự chạy requestAnimationFrame, hãy gọi bằng vòng lặp hiện có của project.

Font GameSans dùng sẵn trong game. Nếu project khác chưa có font này, module tự dùng system-ui; không cần tải font để cổng hoạt động.
