# Gom 0.6.3 — 27/10/2026

Gom 0.6.3 làm gọn header từ 64px xuống 52px và chỉnh đồng bộ các control
trong Cài đặt. Bộ chọn tài khoản trên header dùng menu macOS; các dropdown
trong Cài đặt và hộp thoại dùng màu, viền và khoảng cách của Gom ở cả sáng/tối.

- Công tắc phân biệt rõ bật, tắt và bị khóa; bấm được cả dòng hoặc dùng bàn phím.
- Nút bị khóa vẫn đọc được và không có hiệu ứng hover như nút đang hoạt động.
- Nút “Gửi thử” giải thích cần cho phép hoặc bật lại thông báo.
- Nhập phiên Chrome có hướng dẫn khi thiếu dữ liệu; tên dài được rút gọn khi
  đóng ô chọn và đọc đầy đủ trong menu mở.
- Lỗi form có màu và thông báo trợ năng phù hợp; chặn tên chỉ chứa khoảng trắng.
- Đồng bộ nhãn trợ năng, focus bàn phím và kích thước phần chat dưới header.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, thư mục dữ liệu
`TinNhanDesktop`, partition tài khoản và tên khóa mã hóa macOS `Tin Nhan`.
Nguồn cập nhật tiếp tục là repository `mhfed/gom` đã sửa từ 0.6.2.

## Cài đặt

Dành cho macOS Apple Silicon (arm64). Lưu bản nháp quan trọng, thoát Gom bằng
⌘Q, mở DMG rồi kéo Gom.app vào Applications và chọn thay thế.
App vẫn ký ad-hoc, chưa có Apple Developer ID/notarization; xem
[hướng dẫn cài đặt](distribution.md) nếu macOS yêu cầu xác nhận.

- `Gom-macOS-arm64-0.6.3.dmg`
- `Gom-macOS-arm64-0.6.3.zip`
- `TinNhan-macOS-arm64-0.6.3.dmg` — bản sao DMG Gom, giữ tên gói cũ
- `SHA256SUMS-Gom-0.6.3.txt`

## Kiểm chứng

- TypeScript, build, đóng gói và 130 unit test đều đạt.
- Giao diện: 37 bố cục, 15 nhóm hành vi; 16 kiểm tra native tabs; kiểm tra focus
  chuyển nhanh, hiệu năng renderer và sáu tài khoản cô lập đều đạt.
- Chín kiểm tra luồng cập nhật của phiên bản 0.6.3 đạt, dùng GitHub giả lập,
  profile tạm và mock keychain.
- Chữ ký app qua `codesign --verify --deep --strict`; ZIP qua kiểm tra CRC,
  DMG qua `hdiutil verify` và mount chỉ đọc. Version, bundle ID, liên kết
  Applications đúng; ASAR trong app, ZIP và DMG giống nhau. Đúng 16 mục trong
  ASAR, 13 file runtime trùng byte với `dist/`.
- Chạy ASAR cuối bằng Electron phát triển với dữ liệu giả: 20 bố cục Cài đặt,
  header 52px, dropdown sáng/tối, công tắc và trạng thái Gửi thử đều đạt,
  không lỗi renderer. Đây không phải kiểm tra Gatekeeper hoặc phiên đăng nhập
  thật. Bằng chứng cục bộ lưu trong `outputs/Gom-0.6.3/`.
- Chi tiết phạm vi kiểm tra UI: [báo cáo rà soát](ui-review-2026-10-27.md).

## SHA-256

```text
674b3c755a2eda2d5773d17abf8f16d0bbba0faaed15fb692671583e0b18a336  Gom-macOS-arm64-0.6.3.dmg
353b02f719a6f92f6ebd8abdbe5d402a43d75f73b7fd7a99d5b39c72030d1efa  Gom-macOS-arm64-0.6.3.zip
674b3c755a2eda2d5773d17abf8f16d0bbba0faaed15fb692671583e0b18a336  TinNhan-macOS-arm64-0.6.3.dmg
```
