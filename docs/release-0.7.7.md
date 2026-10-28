# Gom 0.7.7

## Giao diện

- Thêm đổi logo cho từng nền tảng từ menu chuột phải trên tab. Có thể chọn logo có sẵn, tải PNG/JPG lên hoặc khôi phục logo mặc định; lựa chọn được lưu trên máy.
- Logo đã chọn hiển thị đồng nhất ở tab, thư viện nền tảng và thẻ tài khoản.

## Windows x64

- Thêm bộ cài Squirrel.Windows theo tài khoản người dùng và tự cập nhật ngay trong app. Gom tải phiên bản mới rồi cài khi bạn chọn khởi động lại.
- Thêm nhập phiên Chrome cho Zalo, Messenger, Instagram và Slack bằng SQLite chỉ đọc cùng DPAPI của người dùng Windows hiện tại. Tinder tiếp tục dùng quy trình DevTools một lần; hướng dẫn Windows dùng `Ctrl+Shift+J`.
- Chrome App-Bound (`v20`) không thể nhập. Gom giữ nguyên phiên đích và hướng dẫn đăng nhập dịch vụ trực tiếp trong app.
- Bản Windows đầu chưa ký Authenticode; SmartScreen có thể hiện cảnh báo và một số chính sách Smart App Control có thể chặn ứng dụng.

## macOS

- Giữ gói arm64 DMG và ZIP hiện có.
- Tự cài trong app vẫn cần bản ký Developer ID và notarization; nếu không, nút tải mở trang GitHub Release để cài thủ công.

## Tệp phát hành

- `Gom-macOS-arm64-0.7.7.dmg`
- `Gom-macOS-arm64-0.7.7.zip`
- `SHA256SUMS-Gom-0.7.7-macos.txt`
- `Gom-win32-x64-0.7.7-Setup.exe`
- `Gom_win32_x64-0.7.7-full.nupkg`
- `RELEASES`
- `SHA256SUMS-Gom-0.7.7-windows.txt`
