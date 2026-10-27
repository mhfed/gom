# Gom 0.7.0 — 27/10/2026

Gom 0.7.0 chuyển thanh nền tảng thành các tab đang mở, phù hợp khi sử dụng
nhiều dịch vụ và website riêng. Header giữ chiều cao 52px.

- Ghim tab thành biểu tượng gọn; tab thường có tên và nút đóng. Nhấp chuột
  phải để ghim, bỏ ghim hoặc đóng tab.
- Tab không vừa cửa sổ được gom vào menu; tab đang dùng luôn hiển thị.
- Nút **+** cạnh tab mở thư viện có tìm kiếm và form thêm website bằng tên/URL.
  Mỗi website có phiên đăng nhập riêng và hỗ trợ nhiều tài khoản.
- Nhớ tab mở, tab ghim và tài khoản cuối sau khi khởi động lại. Đóng tab giữ
  dữ liệu đăng nhập; đóng tab cuối về thư viện.
- Website riêng chỉ tải khi được chọn; đóng tab lưu dữ liệu phiên rồi giải
  phóng trang. Ba nền tảng nhắn tin có sẵn giữ hoạt động nền theo cơ chế cũ.
- Cài đặt, bộ lọc tài khoản, thông báo và chuyển nhanh nhận nền tảng mới.
  Sửa luồng quay lại từ Cài đặt khi tab đã đóng hoặc tài khoản đã lưu trữ.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, thư mục `TinNhanDesktop`,
partition tài khoản và tên khóa mã hóa macOS `Tin Nhan`.

## Cài đặt và giới hạn

Dành cho macOS Apple Silicon (arm64). Lưu bản nháp quan trọng, thoát Gom bằng
⌘Q, mở DMG rồi kéo Gom.app vào Applications và chọn thay thế. App ký ad-hoc,
chưa có Apple Developer ID/notarization; xem [hướng dẫn cài đặt](distribution.md)
nếu macOS yêu cầu xác nhận nhà phát triển.

Catalog tài khoản nâng lên v2 khi lưu thay đổi. Bản 0.6.x không đọc được catalog
mới, kể cả backup sau khi lưu; nên tiếp tục dùng 0.7.x hoặc mới hơn, giữ nguyên
thư mục dữ liệu. Website đăng nhập SSO qua origin khác còn hạn chế. Khả năng
giữ bản nháp khi đóng website phụ thuộc chính website đó.

- `Gom-macOS-arm64-0.7.0.dmg`
- `Gom-macOS-arm64-0.7.0.zip`
- `TinNhan-macOS-arm64-0.7.0.dmg` — cùng nội dung DMG Gom, giữ tên gói cũ
- `SHA256SUMS-Gom-0.7.0.txt`

Chi tiết triển khai và kiểm thử tính năng: [Tab đang mở và website riêng](provider-tabs-2026-10-27.md).


## Kiểm chứng bộ cài

- TypeScript, build, đóng gói và 150 unit test đạt trên phiên bản 0.7.0.
- Chữ ký app, app trong ZIP và app trong DMG qua `codesign --verify --deep
  --strict`. ZIP qua CRC; DMG qua `hdiutil verify`, mount chỉ đọc và kiểm tra
  liên kết Applications. ASAR của cả ba bản trùng nhau.
- Nội dung ASAR đúng 16 mục trong allowlist; 13 file runtime trùng byte với
  `dist/`. Version 0.7.0, bundle ID, icon và hash ASAR trong Info.plist đều đúng.
- Chạy mã ASAR cuối bằng Electron phát triển với profile tạm và mock keychain:
  20 bố cục Cài đặt ở hai theme, dropdown, công tắc và header 52px đều đạt.
- Toàn bộ 15 nhóm kiểm tra tab/website cũng chạy đạt trên ASAR cuối, gồm thêm
  website bằng form, native menu, ghim, overflow, cô lập phiên, đóng/mở, khởi
  động lại và các trường hợp quay lại từ Cài đặt; không lỗi renderer.
- Chín nhóm kiểm tra cập nhật 0.7.0 đạt với GitHub giả lập. Không dùng tài khoản
  cá nhân hoặc gửi tin thật. Bằng chứng lưu tại `outputs/Gom-0.7.0/`.

Các kiểm tra runtime dùng Electron 45.0.0 phát triển nạp ASAR đã đóng gói;
không xác nhận Gatekeeper, notarization, đăng nhập dịch vụ thật hoặc quyền
Keychain trên máy người nhận. Không thay app đang cài của người dùng.

## SHA-256

```text
e1669548414fa9a88c0f9b7c570d350cda07896c1883990d94b9a9d47778bba2  Gom-macOS-arm64-0.7.0.dmg
b662530de16cc02aedf8aa43a7891b2003114ce6e736a17b3c4d675d5939c757  Gom-macOS-arm64-0.7.0.zip
e1669548414fa9a88c0f9b7c570d350cda07896c1883990d94b9a9d47778bba2  TinNhan-macOS-arm64-0.7.0.dmg
```
