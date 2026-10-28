# Gom 0.7.8 — Không gian kín

## Không gian kín

- Thêm biểu tượng ổ khóa trên thanh công cụ để đặt mật khẩu riêng và mở các tài khoản kín. Mật khẩu dài 8–256 ký tự; đổi mật khẩu cần mật khẩu hiện tại.
- Trong **Cài đặt → Tài khoản**, chọn **Đưa vào không gian kín** hoặc **Đưa ra ngoài** khi đã mở khóa.
- Khóa nhanh bằng **⌘/Ctrl Shift L** trong Gom. Tự khóa khi ẩn/thu nhỏ cửa sổ, máy ngủ, màn hình khóa hoặc khởi động lại; chuyển sang ứng dụng khác không tự khóa.
- Khi khóa, tài khoản kín được ẩn khỏi danh sách, tìm kiếm nhanh, thư viện, menu khay và số chưa đọc. Cửa sổ phụ được ẩn và âm thanh tắt. Phiên đăng nhập và bản nháp trong trang đang mở được giữ qua khóa/mở.
- Tài khoản kín luôn tắt thông báo, kể cả khi mở khóa, để tránh phát sinh lịch sử thông báo hệ điều hành. Thông báo đã phát trước khi chuyển tài khoản vào không gian kín có thể vẫn còn trong lịch sử hệ điều hành.
- Tài khoản kín đăng nhập trực tiếp trong Gom; nhập phiên Chrome áp dụng cho tài khoản thường.

## Giới hạn bảo vệ

Mật khẩu chặn truy cập qua giao diện Gom, **không mã hóa lại cookie hoặc dữ liệu phiên trên đĩa** và không bảo vệ khỏi người có quyền đọc/sửa tệp bằng tài khoản hệ điều hành của bạn. Không có nút đặt lại mật khẩu làm hiện lại tài khoản kín khi quên mật khẩu.

## Sửa lỗi

- Sửa biểu thức nhận diện trang đăng nhập Tinder.
- Giữ màn hình đang dùng của tài khoản thường khi ẩn/hiện Gom.
- Giữ khả năng mở Cài đặt và thư viện khi mọi tài khoản đều kín; bảo vệ trạng thái riêng tư khi việc ghi cấu hình bị gián đoạn.

## Bộ cài

- macOS Apple Silicon: `Gom-macOS-arm64-0.7.8.dmg`, `Gom-macOS-arm64-0.7.8.zip` và `SHA256SUMS-Gom-0.7.8-macos.txt`.
- Windows x64: `Gom-win32-x64-0.7.8-Setup.exe`, `Gom_win32_x64-0.7.8-full.nupkg`, `RELEASES` và `SHA256SUMS-Gom-0.7.8-windows.txt`.

Bản Mac ký ad-hoc, chưa notarize; cập nhật qua DMG tải thủ công. Bản Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app. Các cảnh báo cài đặt của hệ điều hành vẫn có thể xuất hiện.
