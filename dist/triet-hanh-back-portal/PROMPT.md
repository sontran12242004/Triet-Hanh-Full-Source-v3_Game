# Prompt tạo / tích hợp cổng quay lại map

Tạo một cổng quay lại map trước cho game 2D Canvas, phong cách Triết Hành:

- Canvas logic 1440 × 900, cổng đặt tại x = 28% chiều rộng, y = 90% chiều cao.
- Cổng gồm hai vòng elip màu xanh ngọc, viền sáng dịu, hơi co giãn theo nhịp sin. Không cần hình ảnh ngoài.
- Phía trên cổng có nhãn nền xanh đen, bo góc, chữ “← Về [tên quốc gia trước]”.
- Chỉ hiện từ map thứ hai; map đầu không có cổng quay lại.
- Khi chân nhân vật ở y > 87% chiều cao và cách tâm cổng theo chiều ngang dưới 95 px, chuyển về mapIndex - 1.
- Cho phép quay lại ngay cả khi chưa hoàn thành NPC của map hiện tại.
- Không xóa câu trả lời, điểm, lượt sai, tên, giới tính hoặc ID lượt chơi. Không gửi thêm bản ghi điểm chỉ vì chuyển map.
- Giữ nguyên điều kiện khóa cổng đi tiếp: cần hoàn thành 3 NPC, tổng 15 câu tại map hiện tại.
- Sau khi chuyển, đặt nhân vật ở x = 50%, y = 82%, xóa mục tiêu di chuyển và các phím đang giữ, tránh tự đi tiếp vào cổng.
- Không kích hoạt cổng khi đang mở hội thoại/câu hỏi, game tạm dừng hoặc chưa tải xong.
- Khi bật giảm chuyển động, giữ cổng đứng yên nhưng vẫn hoạt động.
- Tách mã thành module độc lập BackPortal. Module chỉ vẽ cổng, kiểm tra vùng chạm và gọi callback changeMap; trạng thái game vẫn do project chủ quản lý.
- Thêm chặn kích hoạt lặp khi đứng trong cổng và cooldown 0,5 giây sau lần chuyển thành công.
- Có demo dùng chấm tròn đại diện nhân vật, điều khiển WASD, phím mũi tên hoặc click/touch.
- Kiểm tra: map đầu không hiện cổng, map sau quay lại được khi chưa xong câu hỏi, không reset tiến độ, không tự nhảy nhiều map liên tiếp.
