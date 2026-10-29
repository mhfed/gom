# Gom 0.8.2 — Nhắc trả lời

**Đang chuẩn bị phát hành.** Bộ cài Mac Apple Silicon, Windows x64 và việc cài lên máy đang chờ kiểm chứng. Bản ổn định đã kiểm chứng gần nhất là [Gom 0.8.1](https://github.com/mhfed/gom/releases/tag/v0.8.1). Xem [biên bản 0.8.2](verification-0.8.2.md) để theo dõi bằng chứng trước khi công bố.

## Nhắc trả lời

- Bấm **Nhắc trả lời**, chọn tài khoản và tự nhập ghi chú cần quay lại. Hẹn **15 phút nữa**, **1 giờ nữa**, **Mai, 9 giờ** hoặc chọn ngày giờ cụ thể theo đồng hồ trên máy.
- Dùng **Mở tài khoản** để quay lại, **Để sau 15 phút** hoặc **Đổi giờ** để hẹn lại. **Hoàn tất** chuyển việc sang **Đã xong**; **Xóa** gỡ khỏi kho. Đổi giờ giữ nguyên ghi chú và tài khoản.
- Ghi chú, giờ hẹn và trạng thái được lưu qua lần thoát/mở lại Gom. Huy hiệu cho biết số việc đến hạn; bộ lọc **Đang chờ** và **Đã xong** giúp xem lại.
- Việc thường có thông báo hệ điều hành khi Gom đang chạy, kể cả khi cửa sổ chính đang ẩn. Bấm thông báo để mở tài khoản. Khi thoát hẳn, Gom xử lý việc quá hạn sau lần mở lại; **Tạm dừng thông báo** hoãn phát thông báo nhưng giữ việc trong danh sách.
- Việc kín chỉ hiện trong danh sách và huy hiệu của Không gian kín, **không gửi thông báo hệ điều hành**, kể cả khi đã mở khóa. Khóa hoặc chuyển không gian xóa nội dung form đang hiển thị và hủy thao tác cũ.

Gom mở đúng tài khoản, không bảo đảm mở đúng cuộc hội thoại. Ghi chú do bạn nhập; Gom không đọc tin nhắn hoặc tự gửi câu trả lời. Quyền thông báo và chế độ Không làm phiền của hệ điều hành có thể ảnh hưởng việc hiển thị banner.

Kho nhắc việc được mã hóa bằng khóa do tài khoản hệ điều hành bảo vệ, tối đa **500 việc / 1 MiB**. Ghi chú tối đa **500 ký tự Unicode**, giờ hẹn tối đa **366 ngày** trong tương lai. Mở form Nhắc trả lời đóng Khay và đưa chat nổi về Gom, giữ trang, phiên đăng nhập và bản nháp. Xem [hướng dẫn Nhắc trả lời](reply-reminders.md).

## Bộ cài dự kiến

Các liên kết dưới đây dành cho bản 0.8.2 sau khi hoàn tất kiểm chứng và phát hành:

- macOS Apple Silicon: [Gom-macOS-arm64-0.8.2.dmg](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-macOS-arm64-0.8.2.dmg), [Gom-macOS-arm64-0.8.2.zip](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-macOS-arm64-0.8.2.zip) và [SHA256SUMS-Gom-0.8.2-macos.txt](https://github.com/mhfed/gom/releases/download/v0.8.2/SHA256SUMS-Gom-0.8.2-macos.txt).
- Windows x64: [Gom-win32-x64-0.8.2-Setup.exe](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-win32-x64-0.8.2-Setup.exe), [Gom_win32_x64-0.8.2-full.nupkg](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom_win32_x64-0.8.2-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.2/RELEASES) và [SHA256SUMS-Gom-0.8.2-windows.txt](https://github.com/mhfed/gom/releases/download/v0.8.2/SHA256SUMS-Gom-0.8.2-windows.txt).

Bản Mac ký ad-hoc, chưa notarize; cập nhật qua DMG tải thủ công. Bản Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app. Các cảnh báo cài đặt của hệ điều hành vẫn có thể xuất hiện.

Dữ liệu tài khoản, mật khẩu Không gian kín và partition đăng nhập được dùng lại khi nâng cấp. Mật khẩu Không gian kín khóa truy cập qua giao diện, không mã hóa lại dữ liệu phiên trên đĩa; kho Khay và nhắc việc có cơ chế mã hóa riêng. Lưu bản nháp quan trọng trước khi thoát app để cập nhật.
