# Gom 0.6.2 — 26/10/2026

Gom 0.6.2 gồm giao diện Settings mới cho cả năm mục, sửa trạng thái tài khoản ở cửa sổ nhỏ, điều hướng bàn phím, vị trí cuộn và thao tác menu. Logo Gom có sẵn được dùng đồng bộ ở thanh điều hướng, Settings, màn hình kết nối, hộp thoại, Dock và Giới thiệu.

Bản này sửa nguồn kiểm tra cập nhật thành repository chính thức `mhfed/gom`. Địa chỉ `mhfed/tin-nhan-desktop` đã trả HTTP 301; bộ kiểm tra cũ chủ động từ chối chuyển hướng nên báo lỗi. API mới trả trực tiếp HTTP 200. App tiếp tục từ chối chuyển hướng, URL giả, repository khác và đường dẫn bộ cài không khớp chính xác.

Tag `v0.6.1` giữ bản cải tiến giao diện trước khi phát hiện lỗi địa chỉ; bản đó chưa được công bố thành Release ổn định. Các bản 0.6.0 trở về trước cần tải DMG trực tiếp để nâng cấp lần này.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, thư mục dữ liệu `TinNhanDesktop`, partition tài khoản và tên nội bộ `Tin Nhan` dùng cho khóa mã hóa macOS.

## Bộ cài

- `Gom-macOS-arm64-0.6.2.dmg`
- `Gom-macOS-arm64-0.6.2.zip`
- `TinNhan-macOS-arm64-0.6.2.dmg` — cùng nội dung DMG Gom, giữ tên gói cũ
- `SHA256SUMS-Gom-0.6.2.txt`

Dành cho macOS Apple Silicon. App ký ad-hoc, chưa có Developer ID/notarization. Phát hành không cài thay ứng dụng đang dùng. Lưu bản nháp quan trọng, thoát Gom bằng ⌘Q, mở DMG rồi kéo Gom.app vào Applications và chọn thay thế. Xem [hướng dẫn cài đặt](distribution.md).

## Kiểm chứng

- Hai kiểm thử hồi quy tái hiện lỗi trước khi sửa; toàn bộ 130 unit tests đã qua sau sửa.
- Giao diện không đổi so với bản 0.6.1 đã kiểm tra: 36 trường hợp bố cục, 10 nhóm thao tác Settings, 12 kiểm tra native tabs và kiểm tra focus hộp thoại; dùng hồ sơ và tài khoản giả.
- TypeScript, build và `npm run make` đã qua; bundle arm64 có metadata 0.6.2.
- 9 kiểm tra tích hợp luồng cập nhật đã qua với hồ sơ tạm: hiển thị trạng thái, mở đúng Release, giữ bản nháp, kiểm soát IPC và lưu tùy chọn tự kiểm tra.
- Chữ ký app qua `codesign --verify --deep --strict`, ZIP qua `unzip -tq`, DMG qua `hdiutil verify`.
- Mount DMG chỉ đọc xác nhận Gom.app, liên kết Applications, version, bundle ID và chữ ký; đã tháo ổ sau kiểm tra.
- ASAR trong DMG và ZIP trùng với app đã đóng gói. Đúng 16 mục trong ASAR; cả 13 file runtime trùng byte với `dist/`, icon và integrity header khớp metadata.
- Chạy ASAR cuối bằng Electron phát triển với hồ sơ tạm và mock keychain: tên/version, menu, logo Dock/Giới thiệu, 20 bố cục Settings sáng/tối và trang tài khoản giả đều qua; không có lỗi renderer hoặc truy cập tài khoản thật. Đây không phải kiểm thử Gatekeeper, bundle đã cài hay phiên đăng nhập thật.
- Bằng chứng cục bộ: `outputs/Gom-0.6.2/` và `outputs/manual-updates/`.

## SHA-256

```text
98a46a792153663232ede2972c6f19b3e1dd5bc02bab8ec12fe7a165b2fdab77  Gom-macOS-arm64-0.6.2.dmg
f8cfc896afc1d90fb27b2a147e584fa6df5f248f6a525e905f2152c36994891f  Gom-macOS-arm64-0.6.2.zip
98a46a792153663232ede2972c6f19b3e1dd5bc02bab8ec12fe7a165b2fdab77  TinNhan-macOS-arm64-0.6.2.dmg
```
