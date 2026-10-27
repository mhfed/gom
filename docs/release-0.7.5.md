# Gom 0.7.5 — 27/10/2026

## Có gì mới

- Thêm màn chào mừng làm trang mở đầu khi khởi động. Bấm logo Gom ở góc trên để quay lại; chọn một tài khoản ở mục **Tiếp tục** để mở đúng phiên.
- Sắp xếp thư viện nền tảng theo nhóm, rút gọn thẻ và thêm Tinder Web.
- Thêm cách dùng phiên Tinder đang mở trong Chrome qua lệnh một lần trong DevTools Console. Chỉ nhập vào tài khoản Tinder đích chưa có phiên; Gom xác minh phiên trước khi giữ lại.
- Thu gọn phần đầu bị trống trong Messenger.
- Tiếp tục dùng cách xưng hô “bạn” trong giao diện.

## Tải xuống

- `Gom-macOS-arm64-0.7.5.dmg`
- `Gom-macOS-arm64-0.7.5.zip`
- `SHA256SUMS-Gom-0.7.5.txt`

Dành cho Mac Apple Silicon (arm64). App ký ad-hoc, chưa có Developer ID/notarization; macOS có thể yêu cầu xác nhận mở app. Để nâng cấp, lưu bản nháp, thoát app bằng ⌘Q, kéo Gom.app vào Applications và chọn thay thế. Dữ liệu `TinNhanDesktop` và phiên đăng nhập được giữ trên máy.

## Kiểm chứng

- TypeScript typecheck thành công.
- Electron Forge tạo app arm64, DMG và ZIP.
- Chữ ký app hợp lệ; DMG qua `hdiutil verify`; ZIP qua kiểm tra toàn vẹn.

SHA-256 của hai gói được đính kèm trong `SHA256SUMS-Gom-0.7.5.txt`.
