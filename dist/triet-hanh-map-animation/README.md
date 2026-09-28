# Triết Hành — Map & Animation

Bộ map và animation độc lập, trích từ bản web v11 ngày 28/09/2026, commit `97920b0ff77230aa5cc4d99f7bccbabc9f1013b1`.

Gồm đúng ảnh nền và mã hiệu ứng đang deploy. Không có nhân vật người chơi, NPC, câu hỏi, bảng xếp hạng hay database. Không cần cài npm package. Animation chạy bằng JavaScript Canvas 2D và WebGL, không phải video/GIF.

## Cấu trúc

- `assets/maps/`: 6 ảnh nền WebP gốc.
- `assets/sprites/koi.webp`: cá koi nền trong suốt.
- `map-scene.js`: module animation độc lập và API điều khiển.
- `index.html`: demo chọn map, tạm dừng và giảm chuyển động.
- `serve.mjs`: server demo bằng Node.js, không cần thư viện bên ngoài.
- `SOURCE.json`: phiên bản nguồn và SHA-256 ảnh để đối chiếu.

## Chạy demo

Giải nén, mở terminal trong thư mục `triet-hanh-map-animation`, chạy:

```bash
node serve.mjs
```

Mở http://localhost:8080. Hoặc dùng VS Code Live Server. Không mở HTML trực tiếp bằng `file://`, vì module và ảnh cần được phục vụ qua HTTP.

## Thêm vào project HTML / JavaScript

Copy nguyên thư mục này vào phần static/public của project. Ví dụ URL truy cập sẽ là `/triet-hanh-map-animation/`.

```html
<canvas id="map" width="1440" height="900"
        style="width:100%;height:auto;aspect-ratio:8/5"></canvas>
<script type="module">
  import { createMapScene } from '/triet-hanh-map-animation/map-scene.js';

  const scene = await createMapScene(document.querySelector('#map'), {
    map: 'china',
    autoStart: true
  });

  // Đổi map: scene.setMap('france');
  // Tạm dừng: scene.stop();
  // Tiếp tục: scene.start();
  // Khi bỏ màn hình: scene.destroy();
</script>
```

Module tự tìm ảnh tương đối với vị trí `map-scene.js`. Giữ nguyên cấu trúc thư mục là đủ; không cần sửa đường dẫn. Nếu tách ảnh sang nơi khác, truyền `assetBase: '/duong-dan/assets/'`.

## Tích hợp vào game có sẵn vòng lặp vẽ

Dùng `autoStart: false` để chỉ có một vòng lặp. `render()` vẽ lại toàn bộ nền và hiệu ứng; hãy vẽ người chơi, NPC, tên và giao diện **sau** lệnh này.

```js
import { createMapScene } from '/triet-hanh-map-animation/map-scene.js';

const canvas = document.querySelector('#game');
canvas.width = 1440;
canvas.height = 900;
const scene = await createMapScene(canvas, {
  map: 'china',
  autoStart: false
});
const ctx = canvas.getContext('2d');
let last = null;
let time = 0;
let frame;

function loop(ms) {
  if (last !== null && !document.hidden) {
    time += Math.min((ms - last) / 1000, 0.04);
  }
  last = ms;
  scene.render(time); // Thời gian tính bằng GIÂY.
  // updatePlayer();
  // drawNPCs(ctx);
  // drawPlayer(ctx);
  // drawUI(ctx);
  frame = requestAnimationFrame(loop);
}
frame = requestAnimationFrame(loop);

// Khi chuyển map trong game:
// scene.setMap('greece');

// Khi đóng màn hình:
// cancelAnimationFrame(frame);
// scene.destroy();
```

Bỏ lời gọi vẽ nền và hiệu ứng cũ khi thay bằng module này, để không vẽ đè hoặc chạy hai lớp animation. Phần chuyển map vẫn do game của bạn quyết định; module không khóa map theo câu hỏi.

Nếu dùng bản PostgreSQL trước đây: đặt folder trong `dist/`, đổi script gọi game thành `type="module"` nếu dùng `import`, rồi khởi tạo scene sau khi canvas có sẵn. Không cần thay schema DB hoặc API lưu điểm.

## React / Vite

Đặt folder vào `public/triet-hanh-map-animation/`. Component ví dụ:

```jsx
import { useEffect, useRef } from 'react';

export default function MapBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let scene;

    async function mount() {
      const url = `${import.meta.env.BASE_URL}triet-hanh-map-animation/map-scene.js`;
      const { createMapScene } = await import(/* @vite-ignore */ url);
      if (disposed) return;
      const next = await createMapScene(canvasRef.current, {
        map: 'china',
        autoStart: false
      });
      if (disposed) { next.destroy(); return; }
      scene = next;
      scene.start();
    }
    mount().catch(console.error);
    return () => { disposed = true; scene?.destroy(); };
  }, []);

  return <canvas ref={canvasRef} width={1440} height={900}
    style={{ width: '100%', height: 'auto', aspectRatio: '8 / 5' }} />;
}
```

## Map và hiệu ứng

| ID | Chỉ số | Quốc gia | Hiệu ứng có sẵn |
|---|---:|---|---|
| `china` | 0 | Trung Quốc | Suối, thác, cá koi, cây lay, hoa bay |
| `greece` | 1 | Hy Lạp | Sóng biển, ánh nước, lá ô liu |
| `france` | 2 | Pháp | Lá thu lay và rơi, ánh đèn ấm |
| `germany` | 3 | Đức | Tán lá lay, ánh đèn, khói, sương mỏng |
| `england` | 4 | Anh | Tán lá lay và cánh hoa vườn |
| `italy` | 5 | Ý | Hiệu ứng hạt lá nhẹ của bản deploy; chưa nâng cấp như 5 map trên |

Các map Hy Lạp, Pháp, Đức, Anh giữ nguyên khu nhà và đường; hiệu ứng tán cây được giới hạn bằng vùng và màu chất liệu. Trung Quốc giữ đúng hiệu ứng của bản deploy hiện tại.

## API

| Lệnh | Công dụng |
|---|---|
| `await createMapScene(canvas, options)` | Tải tài nguyên, trả về scene |
| `scene.setMap('china')` hoặc `scene.setMap(0)` | Đổi map |
| `scene.render(seconds)` | Vẽ một frame; dùng khi `autoStart: false` |
| `scene.start()` / `scene.stop()` | Chạy / dừng vòng lặp nội bộ |
| `scene.setReducedMotion(true)` | Tắt chuyển động, giữ nền tĩnh |
| `scene.resize(1440, 900)` | Đổi kích thước canvas; nên giữ tỷ lệ 8:5 |
| `scene.map` | ID map hiện tại |
| `scene.reducedMotion` | Trạng thái giảm chuyển động |
| `scene.destroy()` | Dừng vòng lặp và giải phóng tài nguyên GPU |

Options: `map` mặc định `china`; `autoStart` mặc định `true`; `assetBase` mặc định `./assets/` tương đối module; `reducedMotion` mặc định theo thiết lập hệ điều hành. Với demo test animation, có thể bỏ chọn “Giảm chuyển động”.

Khi WebGL không khả dụng, nền và các hiệu ứng Canvas 2D vẫn hiển thị; biến dạng nước/tán cây cần WebGL. Nên phục vụ ảnh cùng tên miền; dùng CDN khác tên miền cần CORS cho ảnh.

## Kiểm tra bản tách

Đã kiểm tra tải đủ 7 ảnh, vẽ 6 map độc lập, đổi map bằng ID/chỉ số, tạm dừng/tiếp tục, giảm chuyển động và giải phóng scene trong bộ kiểm tra Canvas. Mã hiệu ứng gốc được giữ nguyên từ bản deploy; các shader đã qua kiểm tra biên dịch và dựng hình OpenGL ES ở bản nguồn. Chưa kiểm tra trên mọi trình duyệt/thiết bị.
