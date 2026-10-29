# Kiểm chứng Gom 0.7.9

## Đã đạt

- TypeScript: `npm run typecheck`.
- Toàn bộ `npm test`: 172 test, không lỗi.
- Kiểm thử giao diện `scripts/private-space-ui-check.mjs`: không gian kín trống, toolbar 940px, hộp mật khẩu giữ trang hiện tại, chuyển tài khoản có xác thực, xóa trạng thái cũ và bỏ qua kết quả website trả về sau chuyển không gian.
- `npm run make`: tạo Mac arm64 DMG/ZIP; `codesign --verify --deep --strict`, `hdiutil verify`, `unzip -tq` đạt.
- `scripts/verify-release-package.mjs`: 19 file runtime hợp lệ, byte giống bản build.
- `scripts/private-space-check.mjs` chạy trên ASAR đóng gói: 17 nhóm đạt. Bao gồm hai chiều IPC, hai phiên cùng nền tảng, bản nháp, tab/ghim/tài khoản đang chọn riêng, ẩn cửa sổ phụ/tắt và khôi phục âm thanh, khởi động khóa, chuyển tài khoản và khóa trong khi lưu tài khoản/website.
- Các fixture dùng profile tạm, mock Keychain và trang giả; không đọc tài khoản cá nhân.

## Kiểm tra phụ có giới hạn

`scripts/native-tabs-check.mjs` là fixture cũ, hiện kỳ vọng ba tab mặc định trong khi bản phát hành trước đã có tám. Lần chạy nguyên bản dừng ở kỳ vọng này. Khi thử cấu hình riêng ba tab và cập nhật các kỳ vọng số trang ấm/overflow trong fixture, 12 trường hợp đạt rồi dừng ở kỳ vọng không có DOM mutation: `renderWelcome()` của cả HEAD 0.7.8 lẫn bản sửa đều dựng lại danh sách ẩn trên mỗi snapshot (45 mutation cho 5 snapshot). Không thay đổi phần hiển thị này hoặc fixture cũ trong bản 0.7.9. Các lỗi kiểm tra phụ có sẵn này không nằm trong thay đổi tách không gian; không coi toàn bộ script đó đã đạt.

## Phát hành và cài đặt

Kết quả Windows, checksum asset GitHub và cài đặt Mac được lưu sau khi hoàn tất tại `outputs/releases/0.7.9/verification.json` (không đưa thư mục kết quả vào bộ cài hoặc Git).
