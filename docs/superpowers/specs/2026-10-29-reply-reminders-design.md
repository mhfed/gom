# Nhắc trả lời

Người dùng chọn tính năng tự đánh dấu việc đang xử lý, ghi chú và chọn giờ để Gom nhắc quay lại.

Thiết kế được tiếp tục theo yêu cầu “hoàn thiện Nhắc trả lời đi chứ” trên nền Gom 0.8.1. Xem [kế hoạch hoàn thiện](../plans/2026-10-29-complete-reply-reminders.md) và [biên bản kiểm chứng](../../verification-reply-reminders.md) cho trạng thái triển khai hiện tại.

- Nhắc việc gắn với một tài khoản hiện có và ghi chú người dùng tự nhập. Không tự đọc nội dung chat, suy đoán người nhận hoặc gửi tin nhắn.
- Modal có danh sách chờ/hoàn tất, ghi chú tối đa 500 ký tự, giờ nhanh 15 phút/1 giờ/sáng mai và datetime-local. Mở modal trả tab nổi về Gom để tránh cửa sổ luôn nổi che form.
- Thao tác: mở tài khoản, để sau 15 phút/đổi giờ, hoàn tất, xóa. Mở tài khoản không tự đánh dấu hoàn tất; không hứa mở đúng hội thoại khi nền tảng không có đường dẫn ổn định.
- Lưu mã hóa bằng Electron safeStorage trong `reminders.json`, ghi nguyên tử và tuần tự. Hỏng file/khóa hệ điều hành không đọc được thì khóa ghi, giữ dữ liệu cũ.
- Nhắc việc thường hiện native notification một lần cho mỗi giờ hẹn khi Gom chạy, kể cả cửa sổ chính ẩn. Tạm dừng thông báo áp dụng cho nhắc việc. Nếu thoát hẳn, các việc quá hạn được xử lý khi mở lại.
- Nhắc việc kín chỉ hiện trong danh sách/badge của không gian kín, không gửi native notification. Snapshot/IPC chặn nhắc việc của không gian còn lại. Chuyển tài khoản vào kín hoặc gỡ tài khoản thu hồi thông báo đang mở.
- Nhắc việc của tài khoản đã gỡ vẫn có thể xem/hoàn tất/xóa trong đúng không gian; không thể mở hoặc phát thông báo cho đến khi khôi phục tài khoản.
- Claim thông báo được lưu trước khi phát để tránh lặp sau khởi động. Nếu đổi không gian giữa lúc claim và phát, bỏ claim có điều kiện để nhắc thường có thể phát khi quay lại.

Lựa chọn triển khai: scheduler trong Gom dùng tick hiện có và chạy khi khởi động/thức máy. Không đăng ký service hay lịch hệ điều hành trong bản đầu. Scope hiện tại là chức năng trong mã nguồn và bản build kiểm thử; build bộ cài/phát hành theo yêu cầu tiếp theo.
