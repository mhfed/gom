# Nhắc trả lời

Nhắc trả lời giúp bạn ghi việc cần quay lại, chọn tài khoản và hẹn giờ trong Gom. Tính năng có từ [Gom 0.8.2](https://github.com/mhfed/gom/releases/tag/v0.8.2) trên Mac Apple Silicon và Windows x64.

## Tạo nhắc việc

1. Bấm biểu tượng **Nhắc trả lời** trên thanh công cụ.
2. Chọn tài khoản cần quay lại và nhập ghi chú, ví dụ “chiều gửi báo giá”.
3. Chọn **15 phút nữa**, **1 giờ nữa**, **Mai, 9 giờ**, hoặc nhập ngày giờ cụ thể.
4. Bấm **Tạo nhắc việc**.

Ngày giờ theo đồng hồ và múi giờ trên máy. Chọn giờ trong tương lai, tối đa 366 ngày; ghi chú tối đa 500 ký tự Unicode. Dấu xuống dòng/tab được giữ, CRLF/CR được chuẩn hóa thành xuống dòng.

## Xử lý việc đã tạo

| Thao tác           | Kết quả                                                        |
| ------------------ | -------------------------------------------------------------- |
| **Mở tài khoản**   | Trở lại đúng tài khoản để bạn tiếp tục; không tự đánh dấu xong |
| **Để sau 15 phút** | Đặt lại giờ nhắc thêm 15 phút từ lúc bấm                       |
| **Đổi giờ**        | Chọn giờ mới, bấm **Lưu giờ**; giữ nguyên ghi chú và tài khoản |
| **Hoàn tất**       | Chuyển việc sang bộ lọc **Đã xong**                            |
| **Xóa**            | Gỡ nhắc việc khỏi kho lưu                                      |

Huy hiệu cạnh biểu tượng cho biết số việc đã đến hạn trong không gian hiện tại. Bộ lọc **Đang chờ** và **Đã xong** giúp xem lại việc cũ. Đổi giờ có nút Hủy; Escape trong ô đổi giờ hủy phần chỉnh đó trước.

Gom mở đúng tài khoản, không bảo đảm tự mở đúng người nhận/cuộc hội thoại. Ghi chú là nội dung bạn tự nhập; Gom không đọc tin nhắn hoặc tự gửi câu trả lời.

## Khi nào Gom nhắc

Nhắc việc thường có thông báo hệ điều hành khi Gom đang chạy, kể cả khi cửa sổ chính đang ẩn. Bấm thông báo để mở tài khoản nguồn. Cần cho phép thông báo của Gom trong cài đặt hệ điều hành.

**Tạm dừng thông báo** trong Gom hoãn việc phát thông báo; các việc đến hạn vẫn nằm trong danh sách. Nếu thoát hẳn Gom, app xử lý việc quá hạn sau khi mở lại. Bản này dùng bộ hẹn trong ứng dụng, không đăng ký lịch hay dịch vụ chạy độc lập của hệ điều hành.

Gom lưu dấu đã phát trước khi yêu cầu hiển thị để tránh lặp sau khởi động lại. Hoãn hoặc đổi giờ sẽ đặt lại dấu này để nhắc ở giờ mới. Việc hệ điều hành có hiển thị được thông báo còn phụ thuộc quyền và chế độ Không làm phiền; danh sách đến hạn vẫn có trong Gom.

## Không gian và dữ liệu

- Nhắc việc thường/kín hiển thị theo tài khoản thuộc không gian hiện tại. Chuyển tài khoản giữa hai không gian cũng chuyển nơi hiển thị nhắc việc gắn với tài khoản đó.
- Nhắc việc kín chỉ hiện trong danh sách/huy hiệu kín, **không gửi thông báo hệ điều hành**, kể cả khi đã mở khóa.
- Khi vào không gian kín, nhắc việc thường chờ đến khi trở lại không gian thường để phát. Khóa/chuyển không gian xóa ghi chú và phần đổi giờ đang hiển thị, hủy kết quả thao tác cũ.
- Tài khoản đã gỡ vẫn giữ nhắc việc để bạn quản lý; cần khôi phục tài khoản trước khi mở hoặc nhận thông báo của nó.
- Thông báo đã xuất hiện trước khi chuyển tài khoản vào kín có thể còn trong lịch sử hệ điều hành.

Kho `reminders.json` được mã hóa bằng khóa do tài khoản hệ điều hành bảo vệ. Mật khẩu Không gian kín khóa quyền qua giao diện Gom, không mã hóa lại phiên Chromium. Kho tối đa 500 việc và 1 MiB; báo đầy thì xóa bớt việc cũ. Lỗi đọc/giải mã/ghi khóa thao tác ghi và giữ dữ liệu cũ; không tự xóa tệp để đặt lại kho.

Mở Nhắc trả lời đóng Khay và đưa trang chat nổi về cửa sổ chính để không che form. Việc đóng/mở form giữ trang đang dùng, phiên đăng nhập và bản nháp, không tải lại trang.

## Kiểm chứng

Xem [biên bản kiểm chứng](verification-reply-reminders.md). Các fixture dùng tài khoản, thông báo, safeStorage và dữ liệu giả trong thư mục tạm; không tạo nhắc việc thật trên hồ sơ người dùng.
