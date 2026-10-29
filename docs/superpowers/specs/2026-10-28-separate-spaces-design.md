# Hai không gian độc lập

Sửa cách hiểu sai của 0.7.8 theo phản hồi trực tiếp của người dùng: mở Không gian kín phải chuyển sang một không gian riêng, không cộng tài khoản kín vào không gian thường.

- Mỗi lúc chỉ hiển thị và cho thao tác tài khoản thuộc không gian đang dùng. Mỗi không gian giữ riêng tab nền tảng, tab ghim, tài khoản đang chọn và giao diện điều hướng.
- Lần đầu không gian kín trống. Thêm tài khoản/website ở đó tạo phiên riêng, tự thuộc không gian kín. Tài khoản cũ ở không gian thường, tài khoản đã đánh dấu kín được giữ nguyên.
- Vào không gian kín cần mật khẩu; thoát/khóa trả về không gian thường và trạng thái trước đó. Tự khóa như 0.7.8. Khởi động luôn ở không gian thường.
- Không gian không hoạt động phải ẩn trang/cửa sổ phụ và tắt âm thanh. Giữ phiên và bản nháp đang mở; không sao chép cookie giữa hai không gian. Thông báo tài khoản kín luôn tắt.
- Giữ khả năng chuyển tài khoản giữa hai không gian bằng xác thực mật khẩu, nhưng không làm lẫn danh sách. Thao tác bất đồng bộ và menu cũ không được vượt qua lần chuyển không gian.
- Hiển thị rõ đang ở Không gian thường hay Không gian kín; trạng thái trống có nút thêm nền tảng/tài khoản.

## Phương án

Giữ catalog tài khoản và partition riêng theo ID, đổi bộ lọc thành hai chiều, lưu hai bộ điều hướng. Đây là lựa chọn triển khai để sửa đúng phạm vi mà giữ nguyên phiên đăng nhập. Tách toàn bộ userData thành hai ứng dụng sẽ phá tương thích và làm phức tạp việc chuyển tài khoản; chỉ lọc giao diện không đủ vì IPC và native views cũng cần được chặn.

Mật khẩu vẫn là khóa giao diện, không mã hóa dữ liệu trên đĩa. Không thay mô hình bảo vệ này trong bản sửa.
