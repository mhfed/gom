# Gom 0.7.6 — 28/10/2026

## Có gì mới

- Thêm menu chuột phải trên trang của các nền tảng: sao chép văn bản đã chọn, cắt/dán/chọn tất cả trong ô nhập liệu, sao chép ảnh, sao chép địa chỉ ảnh, lưu ảnh và sao chép liên kết.
- Nhấn ⌘C khi con trỏ đang trên ảnh đã tải trong trang để sao chép ảnh. Nếu đang chọn văn bản hoặc con trỏ nằm trong ô nhập liệu, ⌘C vẫn sao chép văn bản như bình thường.

## Tải xuống

- `Gom-macOS-arm64-0.7.6.dmg`
- `Gom-macOS-arm64-0.7.6.zip`
- `SHA256SUMS-Gom-0.7.6.txt`

Dành cho Mac Apple Silicon (arm64). App ký ad-hoc, chưa có Developer ID/notarization; macOS có thể yêu cầu xác nhận mở app. Để nâng cấp, lưu bản nháp, thoát app bằng ⌘Q, kéo Gom.app vào Applications và chọn thay thế. Dữ liệu `TinNhanDesktop` và phiên đăng nhập được giữ trên máy.

## Kiểm chứng

- TypeScript typecheck thành công.
- Electron Forge tạo app arm64, DMG và ZIP.
- Chữ ký app hợp lệ; DMG qua `hdiutil verify`; ZIP qua kiểm tra toàn vẹn.

SHA-256 của hai gói được đính kèm trong `SHA256SUMS-Gom-0.7.6.txt`.
