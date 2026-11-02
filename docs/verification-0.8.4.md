# Biên bản phát hành Gom 0.8.4

## macOS Apple Silicon

- `npm run build` và `npm run make` đã tạo DMG và ZIP.
- `codesign --verify --deep --strict`: thành công với `Gom.app`.
- `hdiutil verify`: DMG hợp lệ.
- SHA-256:
  - DMG: `53e51cb28742d0fbcb50a74008ff29a02b78a19f255edc7a409ae13c516be4d7`
  - ZIP: `afc432671cc09142c86cacfc9202e77728b7451d3ef326dfe94aef3fe0738a21`

## Windows x64

Windows chưa có trong release 0.8.4. Thư mục app đã đóng gói nhưng chưa tạo bộ cài Squirrel; workflow GitHub hiện không khởi chạy do khóa billing tài khoản. Landing page tiếp tục cung cấp bộ cài Windows 0.8.3 từ release trước trên repository gốc.

## GitHub Release

- Fork: `vidongls/gom`.
- Tag: `v0.8.4`.
- Release: <https://github.com/vidongls/gom/releases/tag/v0.8.4>.
- Asset công khai: DMG, ZIP và `SHA256SUMS-Gom-0.8.4-macos.txt`.
- Release note ghi rõ Windows chưa có trong bản phát hành này.
