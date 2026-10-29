# Gom 0.7.9 — Hai không gian riêng

## Sửa Không gian kín

- Nhập mật khẩu chuyển sang **Không gian kín** với danh sách tài khoản và tab riêng. Tài khoản thường không còn xuất hiện lẫn vào khi mở khóa.
- Mỗi không gian giữ riêng tab mở, tab ghim, tài khoản đang chọn và trạng thái điều hướng. Khóa trả về không gian thường và khôi phục trạng thái trước đó.
- Không gian kín mới bắt đầu trống. Tài khoản và website thêm tại đây tự thuộc không gian kín, dùng phiên đăng nhập riêng.
- Thanh công cụ hiển thị rõ **Không gian thường** hoặc **Không gian kín**. Màn hình trống hướng dẫn thêm nền tảng hoặc tài khoản.
- Mở hộp nhập mật khẩu giữ nguyên trang đang dùng. Chuyển tài khoản vào không gian kín được xác thực và hoàn tất cùng lần chuyển không gian.
- Khi chuyển không gian, trang và cửa sổ phụ của không gian trước được ẩn và tắt âm thanh; phiên đăng nhập và bản nháp đang mở được giữ.

## Nâng cấp từ 0.7.8

Giữ nguyên mật khẩu, phiên đăng nhập và phân loại tài khoản đang có. Tài khoản thường vẫn ở không gian thường; tài khoản đã đánh dấu kín vẫn ở không gian kín. Không sao chép tài khoản hoặc cookie giữa hai không gian.

Gom luôn khởi động ở không gian thường. Tự khóa khi ẩn/thu nhỏ cửa sổ, máy ngủ hoặc màn hình khóa; chuyển sang ứng dụng khác không tự khóa. Tài khoản kín luôn tắt thông báo và đăng nhập trực tiếp trong Gom.

## Giới hạn bảo vệ

Mật khẩu chặn truy cập qua giao diện Gom, **không mã hóa lại cookie hoặc dữ liệu phiên trên đĩa** và không bảo vệ khỏi người có quyền đọc/sửa tệp bằng tài khoản hệ điều hành của bạn. Không có nút đặt lại mật khẩu làm hiện lại tài khoản kín khi quên mật khẩu.

## Bộ cài

- macOS Apple Silicon: `Gom-macOS-arm64-0.7.9.dmg`, `Gom-macOS-arm64-0.7.9.zip` và `SHA256SUMS-Gom-0.7.9-macos.txt`.
- Windows x64: `Gom-win32-x64-0.7.9-Setup.exe`, `Gom_win32_x64-0.7.9-full.nupkg`, `RELEASES` và `SHA256SUMS-Gom-0.7.9-windows.txt`.

Bản Mac ký ad-hoc, chưa notarize; cập nhật qua DMG tải thủ công. Bản Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app. Các cảnh báo cài đặt của hệ điều hành vẫn có thể xuất hiện.
