# Quản lý tài nguyên

Tính năng trong mã nguồn đang phát triển, chưa có trong bộ cài 0.8.2.

## Xem mức sử dụng

Mở **Cài đặt → Tài nguyên**, hoặc `⌘/Ctrl K` rồi tìm **Quản lý tài nguyên**. Chọn sắp xếp theo RAM, CPU hoặc tên tài khoản.

- **Tổng Gom** là tài nguyên của toàn ứng dụng, bao gồm phần nền của các không gian khác nhưng không liệt kê tài khoản của không gian đó.
- **Tài khoản đang hiển thị** là phần đo được và quy riêng cho những tài khoản trong danh sách hiện tại.
- **Phần còn lại của Gom** gồm khung ứng dụng, tiến trình dùng chung và phần nền chưa quy được vào các hàng hiện tại.
- RAM là working set quy đổi sang MiB, có thể bao gồm bộ nhớ dùng chung. Số theo tài khoản là ước tính và có thể chỉ phản ánh một phần chi phí. Không cộng lặp cùng một tiến trình vào nhiều tài khoản.
- Dấu **—** nghĩa là chưa đo được. CPU cần ít nhất hai mẫu liên tiếp của cùng tiến trình; mẫu đầu hiển thị —. Số 0 ở mẫu sau có thể là kết quả idle thực sự.

Gom lấy mẫu khoảng mỗi 4 giây khi mục Tài nguyên đang mở và cửa sổ đang hiện. Rời mục này, mở hộp thoại che trang, ẩn/thu nhỏ cửa sổ hoặc máy ngủ sẽ dừng đo. Số liệu làm mới khi quay lại; không lưu lịch sử hoặc gửi dữ liệu đo ra máy chủ.

## Tạm ngủ tài khoản

Bấm **Tạm ngủ** cạnh tài khoản đang chạy, đọc xác nhận rồi chọn **Tạm ngủ** để đóng trang đó. Gom ghi dữ liệu phiên xuống đĩa trước khi đóng và nhớ lựa chọn sau khi mở lại ứng dụng.

Thông báo nền tảng và số chưa đọc ngừng cập nhật khi ngủ. **Bản nháp chưa được nền tảng lưu có thể mất**, vì Gom không đọc hoặc tự sao lưu trình soạn tin của website. Tài khoản khác giữ nguyên trang và bản nháp đang mở.

Gom chặn ngủ nếu đang nhập phiên/thay đổi tài khoản, hoặc tài khoản có chat nổi, cửa sổ phụ, lượt tải xuống chưa xong hay đang phát âm thanh. Hãy kết thúc hoạt động tương ứng trước. Đây không phải cơ chế phát hiện được mọi cuộc gọi; vẫn cần kiểm tra nội dung quan trọng trước khi xác nhận đóng trang.

Nếu lỗi ghi dữ liệu phiên/cấu hình hoặc trạng thái không gian thay đổi trong lúc xử lý, Gom báo lỗi/hủy thao tác và giữ trang đang chạy. Thao tác chủ động chọn lại tài khoản cũng hủy lượt ngủ chưa hoàn tất.

## Đánh thức và phiên đăng nhập

Bấm **Đánh thức** để dựng lại trang và tiếp tục xem bảng tài nguyên. Chủ động chọn tài khoản từ tab, danh sách tài khoản, bảng lệnh hoặc Nhắc trả lời sẽ đánh thức rồi mở tài khoản đó.

Gom dùng lại đúng partition, cookie và dữ liệu phiên đang có. Trang mở về địa chỉ vào nền tảng đã cấu hình; không bảo đảm khôi phục hội thoại, vị trí cuộn hoặc bản nháp trong bộ nhớ của trang cũ. Nền tảng có thể yêu cầu đăng nhập lại nếu phiên đã hết hạn.

Nhắc trả lời của Gom chạy riêng với trang nên vẫn có thể phát theo cài đặt thông báo/Tập trung khi tài khoản ngủ. Bấm mở từ nhắc việc đánh thức tài khoản. Tài khoản kín chỉ mở được trong không gian kín đã mở khóa; khóa/đổi không gian xóa các hàng tài nguyên của không gian cũ.

## Dữ liệu cục bộ

`resource-sleep.json` lưu ID tài khoản đã chọn ngủ, không lưu nội dung chat, bản nháp, mật khẩu hoặc URL hội thoại. Nếu kho không đọc/ghi được, Gom báo lỗi và giữ dữ liệu cũ; xử lý nguyên nhân rồi mở lại app. Không tự xóa tệp để đặt lại trạng thái.

Bản đầu chỉ ngủ thủ công; không tự ngủ theo thời gian, không kill tiến trình, không đặt giới hạn RAM cứng và không hứa một mức tiết kiệm tài nguyên cố định.
