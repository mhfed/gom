# Tập trung có hẹn giờ

Tính năng trong mã nguồn đang phát triển, chưa nằm trong bộ cài 0.8.2.

## Bắt đầu và thay đổi phiên

1. Mở **Cài đặt → Thông báo → Tập trung có hẹn giờ**.
2. Chọn **30 phút**, **1 giờ** hoặc **Đến giờ tùy chọn**. Giờ kết thúc phải ở trong tương lai, tối đa 24 giờ.
3. Nếu cần, bật **Tắt cả âm thanh trang**. Lựa chọn này mặc định tắt; bật lên có thể làm im cả cuộc gọi và video đang phát trong Gom.
4. Bấm **Bắt đầu tập trung**.

Khi đang chạy, chọn thời gian/âm thanh mới rồi bấm **Cập nhật phiên**, hoặc bấm **Kết thúc sớm**. Thanh công cụ có chỉ báo Tập trung; bấm để trở lại phần cài đặt. Thời gian hiển thị theo múi giờ trên máy.

Mở `⌘/Ctrl K` để tìm **Tập trung 30 phút**, **Tập trung 1 giờ**, **Tập trung có hẹn giờ** hoặc **Kết thúc Tập trung**. Menu biểu tượng Gom ở thanh menu/khay hệ thống cũng có các thao tác nhanh. Khởi tạo nhanh mặc định giữ âm thanh; đổi thời lượng của phiên đang chạy giữ lựa chọn âm thanh của phiên đó.

## Thông báo và âm thanh

- Gom chặn thông báo mới trong thời gian Tập trung. Tin nhắn và huy hiệu chưa đọc tiếp tục hoạt động theo nền tảng.
- Thông báo Nhắc trả lời đến hạn được hoãn; việc vẫn hiện trong danh sách. Sau khi kết thúc Tập trung, Gom phát nhắc việc còn đủ điều kiện, không tự đánh dấu hoàn tất.
- **Tạm dừng thông báo** thủ công hoạt động độc lập. Nếu bạn đã bật nó, hết phiên Tập trung vẫn giữ tạm dừng cho đến khi bạn chủ động tắt.
- Các lựa chọn **Cho phép**, **Tắt**, **Hỏi** của từng tài khoản giữ nguyên. Kết thúc Tập trung không tự cấp quyền cho tài khoản đang bị tắt.
- Nếu bật tắt âm thanh, áp dụng cho mọi trang tài khoản trong Gom, bao gồm popup và chat nổi. Chuyển tài khoản không bật lại âm thanh khi phiên vẫn còn hạn.
- Tài khoản kín tiếp tục không gửi thông báo. Kết thúc Tập trung không bật âm thanh cho trang thuộc không gian đang bị khóa/ẩn.

Thông báo đã phát trước khi bắt đầu có thể còn trong lịch sử hệ điều hành. Tập trung trong Gom không thay đổi chế độ Tập trung/Không làm phiền hoặc quyền thông báo của macOS/Windows.

## Khi ẩn cửa sổ, ngủ máy hoặc thoát app

Bộ hẹn giờ hoạt động trong Gom khi cửa sổ bị ẩn. Thời điểm kết thúc được lưu trong cấu hình trên máy. Nếu thoát app rồi mở lại trước khi hết giờ, phiên tiếp tục; mở lại sau giờ kết thúc thì phiên đã kết thúc. Máy thức dậy sẽ kiểm tra lại thời điểm kết thúc ngay, không tải lại trang nền tảng.

Gom không cần chạy để đếm từng giây khi đã thoát; app đối chiếu thời điểm đã lưu khi mở lại. Đồng hồ máy thay đổi thì phiên tuân theo thời điểm kết thúc trên đồng hồ mới. Bản đầu chưa có lịch giờ làm việc lặp theo ngày.
