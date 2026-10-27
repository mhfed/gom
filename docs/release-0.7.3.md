# Gom 0.7.3 — 27/10/2026

## Có gì mới

- Thêm mục **Dùng phiên có sẵn** với lựa chọn tài khoản đích và profile Chrome nguồn.
- Nhập cookie xác thực trong phạm vi đã giới hạn cho Messenger, Instagram, Slack và Zalo; kiểm tra phiên trong cửa sổ tạm trước khi chuyển sang tài khoản đích.
- Giữ phiên đích nếu đã đăng nhập, cookie bị trùng hoặc xác minh thất bại. Cookie xác thực được khôi phục nếu bước ghi phiên lỗi.
- Gmail, Discord và Telegram vẫn cần đăng nhập trực tiếp trong Gom; Telegram và Zalo có thể dùng QR.

## Tải xuống

- `Gom-macOS-arm64-0.7.3.dmg`
- `Gom-macOS-arm64-0.7.3.zip`
- `SHA256SUMS-Gom-0.7.3.txt`

Dành cho Mac Apple Silicon (arm64). App ký ad-hoc, chưa có Developer ID/notarization; macOS có thể yêu cầu xác nhận mở app. Để nâng cấp, thoát app bằng ⌘Q, kéo Gom.app vào Applications và chọn thay thế. Giữ nguyên thư mục dữ liệu `TinNhanDesktop`.

## Kiểm chứng

- TypeScript typecheck thành công.
- Electron Forge tạo app arm64, DMG và ZIP.
- Chữ ký app hợp lệ; DMG qua `hdiutil verify`; ZIP qua kiểm tra toàn vẹn.
- `app.asar` chỉ chứa các file runtime được khai báo.

SHA-256 của hai gói được đính kèm trong `SHA256SUMS-Gom-0.7.3.txt`.
