# Gom 0.9.1 — Giữ thức cho tài khoản

Bản cập nhật cho macOS Apple Silicon, ngày 06/11/2026.

- **Giữ thức:** bật riêng cho từng tài khoản trong Cài đặt → Tài nguyên để Gom bỏ qua tự ngủ sau 15 phút. Lựa chọn được lưu qua lần mở lại.
- Giữ thức không đánh thức trang đang ngủ. **Tạm ngủ** thủ công vẫn hoạt động; khi tắt Giữ thức, bộ đếm tự ngủ bắt đầu lại đủ 15 phút.
- Windows tiếp tục dùng bản 0.8.3. Gom không cần dịch vụ máy chủ và không đọc nội dung cuộc trò chuyện.
- Gói macOS ký ad-hoc, chưa ký Developer ID hoặc notarize; xem [hướng dẫn phân phối](distribution.md).

## Tải xuống

- macOS Apple Silicon: [DMG](https://github.com/mhfed/gom/releases/download/v0.9.1/Gom-macOS-arm64-0.9.1.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.9.1/Gom-darwin-arm64-0.9.1.zip).
- Windows x64: [Setup.exe bản 0.8.3](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-win32-x64-0.8.3-Setup.exe).

## Kiểm chứng

- Bundle phiên bản 0.9.1, bundle ID `local.mhfed.tinnhan.desktop`; chữ ký ad-hoc hợp lệ.
- DMG được hdiutil verify xác nhận; ZIP vượt qua kiểm tra cấu trúc. Đã kiểm tra nội dung DMG có Gom.app, liên kết Applications và Mo-Gom.command.
- Bản 0.9.1 đã được cài vào `/Applications/Gom.app`.

## SHA-256

```text
82f71c170eb98a8f5aa448a280a613c2e051baadd2aa99a2d39a76ffedcd2e68  Gom-macOS-arm64-0.9.1.dmg
d211bcacfabe52dd331c190e092c50c85ba17de27c6429323913fd0d52e012ef  Gom-darwin-arm64-0.9.1.zip
```
