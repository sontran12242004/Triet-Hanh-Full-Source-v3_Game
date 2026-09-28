# Triết Hành — PostgreSQL

Bản source độc lập: 6 map, 18 NPC, 90 câu hỏi, nhân vật nam/nữ áo cam, tự lưu sau mỗi NPC và bảng xếp hạng dùng PostgreSQL. Không sử dụng SQLite.

## Thiết lập trên Windows / pgAdmin

Yêu cầu: Node.js 22.13 trở lên và PostgreSQL đang chạy.

1. Giải nén gói này, mở terminal trong thư mục có `package.json`.
2. Trong pgAdmin, kết nối server PostgreSQL của bạn. Bấm phải Databases → Create → Database, đặt tên `triet_hanh`. Hoặc mở Query Tool của database `postgres` rồi chạy file `db/create_database.sql` (chạy riêng, không gộp vào transaction tạo bảng).
3. Sao chép `.env.example` thành `.env`. Trong PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Sửa `.env` bằng thông tin thật trên máy bạn:

```dotenv
PGHOST=localhost
PGPORT=5432
PGDATABASE=triet_hanh
PGUSER=postgres
PGPASSWORD="mat_khau_PostgreSQL_cua_ban"
PGSSL=false
PORT=3000
HOST=127.0.0.1
```

5. Chạy:

```sh
npm install
npm run db:init
npm start
```

6. Mở **http://localhost:3000**. Trả lời đúng đủ 5 câu của một NPC, game tự lưu một lần. Bấm Xếp hạng để xem.

`npm run db:init` tạo bảng và index bằng `db/schema.sql`. Nếu bạn muốn dùng pgAdmin: chọn database `triet_hanh`, mở Query Tool và chạy `db/schema.sql`, sau đó bỏ qua lệnh db:init. Không import file `.sqlite` của gói cũ vào PostgreSQL.

## Dùng PostgreSQL trên server khác

Điền PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD theo server đó. Hoặc đặt DATABASE_URL thay cho 5 biến trên. Nếu dùng URL và mật khẩu có ký tự đặc biệt, phải mã hóa phần mật khẩu theo URL; dùng các biến PG riêng thường đơn giản hơn.

Nếu nhà cung cấp yêu cầu TLS, dùng PGSSL=true và PGSSL_CA_FILE nếu họ cung cấp chứng chỉ CA. Không kết hợp tùy chọn sslmode trong DATABASE_URL với PGSSL tùy chỉnh; dùng một cách cấu hình. File .env không được đưa lên Git.

## Database

Bảng `scores`: một dòng cho mỗi lượt chơi, được cập nhật sau mỗi NPC.

| Cột | Ý nghĩa |
|---|---|
| id | ID lượt chơi duy nhất |
| name | Tên nhân vật, tối đa 24 ký tự |
| gender | male / female |
| mode | full |
| rules_version | 2 cho bản 90 câu |
| score | max(0, số câu đúng × 100 − số lần sai × 25) |
| duration | Thời gian tính bằng giây |
| mistakes | Tổng số lần sai tại mốc lưu |
| answered | Số câu đúng, tối đa 90 |
| npc_count | Số NPC hoàn thành, tối đa 18 |
| answers_json | JSONB chứa mã câu đúng, ví dụ ["0:0:0","0:0:1"] |
| created_at | Thời điểm ghi danh đầu tiên, Unix milliseconds |
| updated_at | Thời điểm cập nhật gần nhất, timestamptz |

`db/leaderboard.sql` xem Top 50 theo điểm giảm dần, thời gian tăng dần. Gửi lại một mốc lưu không tạo dòng trùng. Yêu cầu đến chậm không ghi đè tiến độ mới hơn.

Nội dung map, NPC và câu hỏi vẫn ở `dist/data.js`. Database lưu tiến độ và thành tích người chơi. Trạng thái tiếp tục chơi, vị trí và lượt sai theo map vẫn được giữ trong trình duyệt; chưa có đăng nhập hoặc khôi phục phiên chơi từ database trên máy khác.

## Cấu trúc source

- `dist/`: toàn bộ giao diện, game, model và hình ảnh.
- `server/index.mjs`: HTTP server phục vụ web và API.
- `server/db.mjs`: kết nối PostgreSQL bằng node-postgres Pool.
- `server/api.mjs`: GET/POST `/api/leaderboard`, kiểm tra dữ liệu và lưu bằng truy vấn tham số $1, $2...
- `scripts/init-db.mjs`: khởi tạo schema.
- `db/`: file SQL PostgreSQL.
- `.env.example`: mẫu cấu hình kết nối.
- `tests/postgres.test.mjs`: kiểm tra schema PostgreSQL và API bằng PGlite (PostgreSQL chạy nhúng), không kết nối database thật của bạn. Chạy `npm test`.

## Lỗi thường gặp

- `28P01`: kiểm tra user/password trong .env.
- `3D000`: tạo database triet_hanh hoặc sửa PGDATABASE.
- `42P01`: chạy npm run db:init để tạo bảng.
- `ECONNREFUSED`: bật dịch vụ PostgreSQL và kiểm tra host/port.
- Đổi PORT nếu cổng 3000 đã được dùng.

## Phạm vi bàn giao

Đây là bộ source đã chuẩn bị cho PostgreSQL của bạn; chưa có thông tin kết nối của bạn nên chưa kết nối tới database đó. Website công khai đã tạo trước đây vẫn dùng database riêng của website, chưa tự chuyển sang PostgreSQL này. Dữ liệu website cũ không có trong gói.

Bảng xếp hạng phục vụ game học tập, chưa xác minh toàn bộ đáp án từ server để chống sửa điểm từ phía client.

Tài liệu driver chính thức: https://node-postgres.com/features/pooling và https://node-postgres.com/features/ssl.
