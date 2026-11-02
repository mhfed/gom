# Biên bản đóng gói Gom 0.8.4

## macOS Apple Silicon

- `npm run build`: thành công.
- `npm run make`: tạo `Gom-macOS-arm64-0.8.4.dmg` và `Gom-darwin-arm64-0.8.4.zip`.
- `codesign --verify --deep --strict`: thành công với `Gom.app`.
- `hdiutil verify`: DMG hợp lệ.
- SHA-256:
  - DMG: `3de61853402ca136cc1e7d1a0017bfedf5a70850c3227fd35c6c79699b948f02`
  - ZIP: `9dec26909f219b0e251dac8cbd85c4194c39d228a82ff264ba3095224f4e2109`

## Windows x64

Đóng gói Squirrel cần Mono và Wine khi chạy ngoài Windows. Máy build macOS hiện không có hai công cụ này; gói Windows sẽ được tạo trên runner Windows và bổ sung kết quả cùng checksum trước khi phát hành.

## Còn chờ trước khi phát hành

- Runner Windows hoàn tất kiểm tra phát hành và tải đủ asset lên draft GitHub Release.
- Đối chiếu bảy asset/checksum Mac và Windows, sau đó mới công bố release.
- Hợp nhất landing page lên `main` và xác nhận GitHub Pages deploy thành công.

Không thử đăng nhập bằng tài khoản WhatsApp thật trong quá trình đóng gói. Bộ cài Mac chưa được cài trên máy người dùng; Windows chưa được đóng gói trên máy này.
