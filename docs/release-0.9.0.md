# Gom 0.9.0 — Cần xử lý, Mẫu trả lời và nhãn khách hàng

Bản cập nhật cho macOS Apple Silicon, ngày 05/11/2026.

- **Cần xử lý:** xem nhắc việc đến hạn và tài khoản có tin chưa đọc tại cùng một nơi. Số ước tính, số chưa đo được và số có thể cũ khi tài khoản đang ngủ được ghi rõ. Số chưa đọc chỉ là tín hiệu theo tài khoản, không xác định cuộc trò chuyện nào cần trả lời.
- **Mẫu trả lời:** tạo, sửa, tìm và sao chép mẫu trong Khay. Mẫu được mã hóa cục bộ, tách theo không gian thường/kín; Gom chỉ sao chép sau thao tác rõ ràng, người dùng tự dán, kiểm tra và gửi.
- **Nhãn khách hàng/brand:** gắn nhãn tối đa 60 ký tự Unicode cho mỗi tài khoản; nhãn xuất hiện trong bộ chọn và tìm kiếm bảng lệnh.
- Backup cấu hình mới dùng phiên bản 2 để lưu nhãn tài khoản thường. Gom vẫn nhập được backup phiên bản 1; tài khoản và dữ liệu nhãn trong không gian kín không được xuất.

Windows tiếp tục dùng bản 0.8.3. Bản này không cần dịch vụ máy chủ và không đọc nội dung cuộc trò chuyện.
Gói macOS ký ad-hoc, chưa ký Developer ID hoặc notarize; xem [hướng dẫn phân phối](distribution.md).

## Tải xuống

- macOS Apple Silicon: [DMG](https://github.com/mhfed/gom/releases/download/v0.9.0/Gom-macOS-arm64-0.9.0.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.9.0/Gom-darwin-arm64-0.9.0.zip).
- Windows x64: [Setup.exe bản 0.8.3](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-win32-x64-0.8.3-Setup.exe).

## Kiểm chứng

- Typecheck, build và toàn bộ kiểm thử đơn vị đạt: 332/332.
- Fixture giao diện Cần xử lý, Khay và bảng lệnh; kiểm thử native Khay và quản lý tài khoản đều đạt với dữ liệu giả.
- Gói cài đặt, chữ ký ad-hoc, bundle ID, phiên bản và SHA-256 được xác minh sau khi đóng gói.

## SHA-256

```text
d0441641bf9dc06f4e78a42a976db213bfacab6e3f53f1045fd01650c6df3119  Gom-macOS-arm64-0.9.0.dmg
c9c5b5512e64ecd4683c96b9bccd575838464577e4e0754408ec6bf3cc4a5ba6  Gom-darwin-arm64-0.9.0.zip
```
