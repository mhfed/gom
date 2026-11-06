# Gom 0.9.2 — Lịch thông báo theo giờ làm việc

Bản cập nhật cho macOS Apple Silicon, ngày 06/11/2026.

- **Lịch thông báo:** đặt ngày và giờ lặp theo tuần, áp dụng chung cho tài khoản trong Gom và theo múi giờ địa phương. Hỗ trợ ca qua nửa đêm.
- Ngoài lịch, Gom chặn thông báo nền tảng và hoãn nhắc trả lời đến hạn. Nhắc việc còn đủ điều kiện được xét lại khi lịch mở; Tạm dừng thủ công, Tập trung và quyền từng tài khoản vẫn được áp dụng.
- Lịch lưu qua lần mở lại. Bản sao lưu cấu hình phiên bản 3 có lịch; các bản phiên bản 1 và 2 vẫn nhập được và lịch sẽ tắt.
- Windows tiếp tục dùng bản 0.8.3. Gom không cần dịch vụ máy chủ và không đọc nội dung cuộc trò chuyện.
- Gói macOS ký ad-hoc, chưa ký Developer ID hoặc notarize; xem [hướng dẫn phân phối](distribution.md).

## Tải xuống

- macOS Apple Silicon: [DMG](https://github.com/mhfed/gom/releases/download/v0.9.2/Gom-macOS-arm64-0.9.2.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.9.2/Gom-darwin-arm64-0.9.2.zip).
- Windows x64: [Setup.exe bản 0.8.3](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-win32-x64-0.8.3-Setup.exe).

## Kiểm chứng

- Typecheck, build và kiểm thử đơn vị đạt: 337/337.
- ASAR phiên bản 0.9.2 gồm 24 tệp runtime đúng allowlist; chữ ký ad-hoc hợp lệ.
- `hdiutil verify` xác nhận DMG hợp lệ; ZIP không có lỗi cấu trúc.

## SHA-256

```text
cef7442add61d74fa1694820a73a6c852c8084a67afb24ebe8f1e287fc1d0c8a  Gom-macOS-arm64-0.9.2.dmg
a381dc30bf79f99ed3ac4d45aa1f215ff589457c0d40af6c3ba1bab1718b1ff4  Gom-darwin-arm64-0.9.2.zip
```
