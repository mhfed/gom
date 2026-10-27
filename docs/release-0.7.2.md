# Gom 0.7.2 — 27/10/2026

## Có gì mới

- Thêm Gmail, Instagram, Discord và Slack làm nền tảng tích hợp sẵn.
- Hiển thị số chưa đọc trên tab cho các nền tảng có thể đọc badge từ giao diện web.
- Ẩn thanh điều hướng Facebook dư thừa trong tab Messenger.
- Giữ luồng đăng nhập Google trong Slack/Discord bên trong app ở các trang xác thực được hỗ trợ.
- Bổ sung tiến trình trạng thái cho updater. Bản phát hành này vẫn mở trang tải thủ công vì máy build chưa có Developer ID và thông tin notarization.

## Tải xuống

- `Gom-macOS-arm64-0.7.2.dmg`
- `Gom-macOS-arm64-0.7.2.zip`
- `SHA256SUMS-Gom-0.7.2.txt`

Dành cho Mac Apple Silicon (arm64). App ký ad-hoc, chưa có Developer ID/notarization; có thể cần xác nhận mở app trong Cài đặt hệ thống. Để nâng cấp, thoát app bằng ⌘Q, kéo Gom.app vào Applications và chọn thay thế. Giữ nguyên thư mục dữ liệu `TinNhanDesktop`.

DMG có `Mo-Gom.command` để mở app sau khi cài nếu macOS chặn do chưa notarize. Chỉ chạy script này nếu đã tin cậy nguồn tải; xem hướng dẫn phân phối để biết cách dùng **Open Anyway** thủ công.

## Kiểm chứng

- 150 unit tests và TypeScript typecheck.
- Electron Forge tạo app arm64, DMG và ZIP.
- Chữ ký app hợp lệ; DMG và ZIP qua kiểm tra toàn vẹn.

Các hash SHA-256 được đính kèm trong `SHA256SUMS-Gom-0.7.2.txt`.
