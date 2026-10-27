# Gom 0.7.4 — 27/10/2026

## Có gì mới

- Chuẩn hóa cách xưng hô trong giao diện: dùng “bạn” khi hướng dẫn người dùng.

## Tải xuống

- `Gom-macOS-arm64-0.7.4.dmg`
- `Gom-macOS-arm64-0.7.4.zip`
- `SHA256SUMS-Gom-0.7.4.txt`

Dành cho Mac Apple Silicon (arm64). App ký ad-hoc, chưa có Developer ID/notarization; macOS có thể yêu cầu xác nhận mở app. Để nâng cấp, thoát app bằng ⌘Q, kéo Gom.app vào Applications và chọn thay thế. Giữ nguyên thư mục dữ liệu `TinNhanDesktop`.

## Kiểm chứng

- TypeScript typecheck thành công.
- Electron Forge tạo app arm64, DMG và ZIP.
- Chữ ký app hợp lệ; DMG qua `hdiutil verify`; ZIP qua kiểm tra toàn vẹn.
- `app.asar` chỉ chứa các file runtime được khai báo.

SHA-256 của hai gói được đính kèm trong `SHA256SUMS-Gom-0.7.4.txt`.
