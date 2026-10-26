# Gom 0.6.1 — 26/10/2026

Bản này gồm giao diện Settings mới cho cả năm mục, trạng thái tài khoản luôn hiển thị ở cửa sổ nhỏ, điều hướng bàn phím, sửa vị trí cuộn và thao tác menu. Logo Gom có sẵn được dùng đồng bộ ở thanh điều hướng, Settings, màn hình kết nối, hộp thoại, Dock và phần Giới thiệu.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, thư mục dữ liệu `TinNhanDesktop`, các partition tài khoản và tên nội bộ `Tin Nhan` dùng cho khóa mã hóa macOS.

## Bộ cài

- `outputs/Gom-macOS-arm64-0.6.1.dmg`
- `outputs/Gom-macOS-arm64-0.6.1.zip`
- `outputs/TinNhan-macOS-arm64-0.6.1.dmg` — bản sao DMG tương thích với bộ cập nhật Tin Nhan 0.5.4
- `outputs/SHA256SUMS-Gom-0.6.1.txt`
- App: `out-release/Gom-darwin-arm64/Gom.app`

Dành cho macOS Apple Silicon. App vẫn ký ad-hoc, chưa có Developer ID/notarization. Quá trình đóng gói và phát hành không cài thay ứng dụng đang dùng.

Lưu bản nháp quan trọng, thoát Gom bằng ⌘Q, mở DMG và kéo Gom.app vào Applications, chọn thay thế. Xem thêm [hướng dẫn cài đặt](distribution.md).

## Kiểm chứng

- Build, TypeScript và 128 unit tests đã qua.
- Giao diện trước đóng gói đã qua 36 trường hợp bố cục, 10 nhóm thao tác Settings, 12 kiểm tra native tabs và kiểm tra focus hộp thoại; dùng hồ sơ và tài khoản giả.
- `npm run make` tạo DMG/ZIP thành công; metadata của app là 0.6.1, kiến trúc arm64.
- Chữ ký app qua `codesign --verify --deep --strict`; ZIP qua `unzip -tq`; DMG qua `hdiutil verify`.
- Mount DMG chỉ đọc xác nhận Gom.app, liên kết `/Applications`, version, bundle ID và chữ ký; đã tháo ổ sau kiểm tra.
- ASAR trong DMG và ZIP trùng với app đã đóng gói. SHA-256 của DMG, ZIP và bản sao tương thích đã kiểm tra thành công.
- Kiểm tra độc lập xác nhận đúng 16 mục trong ASAR; cả 13 file runtime trùng byte với `dist/`, PNG và ICNS đúng logo Gom, integrity header khớp metadata.
- Mở thử ASAR cuối bằng Electron phát triển với hồ sơ tạm: menu, tên/version, icon, 20 bố cục Settings sáng/tối và các trang giả đều qua; không có lỗi renderer hay truy cập tài khoản thật. Đây không phải kiểm thử thực thi bundle đã cài, Gatekeeper hay phiên đăng nhập thật.
- Bằng chứng kiểm tra nằm trong `outputs/Gom-0.6.1/`.

DMG SHA-256: `8210ecf93e25bbc04258a95b7eaeff71572bfac4adb86b9767550cd60452c7fb`.

ZIP SHA-256: `654e2faa61aeb2aa7e3a3827a0121038f1c02b164919c649c766b4b1b110edc9`.
