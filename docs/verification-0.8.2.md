# Kiểm chứng Gom 0.8.2

**Trạng thái: đang chuẩn bị, chưa xác nhận phát hành hoặc cài đặt.** Bằng chứng mã nguồn bên dưới đã có trước khi nâng phiên bản. Các lượt kiểm chứng mới trên nguồn phát hành, gói Mac, Windows, asset tải lên và bản cài trên máy còn chờ ghi kết quả thực tế.

## Bằng chứng mã nguồn đã có

Tính năng Nhắc trả lời hoàn thiện ở commit `57fa5b8`, trên nền Gom 0.8.1. [Biên bản tính năng](verification-reply-reminders.md) ghi nhận:

- Typecheck, build mã nguồn và **248/248 unit test** đạt, không bỏ qua bài nào.
- **15 nhóm Nhắc trả lời**, **16 kiểm tra native tabs**, **17 kiểm tra Không gian kín**, **12 nhóm chat nổi** và **10 nhóm Khay** đạt trên mã nguồn.
- Kiểm chứng bao gồm lưu/đọc lại ghi chú và giờ tùy chỉnh, thông báo một lần khi đang chạy/ẩn, hoãn/đổi giờ, pause, không gian kín, thao tác cũ sau khóa, tài khoản đã gỡ, kho hỏng và dung lượng gần đầy.

Đây là lịch sử kiểm chứng tính năng, chưa thay thế lượt kiểm chứng trên mã nguồn và ASAR của bản phát hành 0.8.2.

## Các bước còn chờ

| Hạng mục | Trạng thái cần bổ sung |
| --- | --- |
| Nguồn phát hành | Chờ typecheck/unit test mới, commit và tag `v0.8.2` |
| Mac Apple Silicon | Chờ build arm64, đối chiếu runtime trong ASAR, kiểm tra chữ ký ad-hoc, DMG và ZIP |
| Hồi quy gói Mac | Chờ Nhắc trả lời, Không gian kín, chat nổi và Khay chạy trên ASAR đóng gói |
| Windows x64 | Chờ URL/run/job CI, số test thực tế và kết quả tạo Setup/Squirrel |
| Hồi quy gói Windows | Chờ đối chiếu ASAR/Squirrel và Nhắc trả lời, Không gian kín, chat nổi, Khay |
| GitHub Release | Chờ đủ bảy asset, đối chiếu SHA-256 và xác nhận xuất bản |
| Cài đặt Mac | Chờ cài bộ gói đã kiểm chứng, kiểm tra version và ASAR của app được cài |

## Asset dự kiến

- `Gom-macOS-arm64-0.8.2.dmg`
- `Gom-macOS-arm64-0.8.2.zip`
- `SHA256SUMS-Gom-0.8.2-macos.txt`
- `Gom-win32-x64-0.8.2-Setup.exe`
- `Gom_win32_x64-0.8.2-full.nupkg`
- `RELEASES`
- `SHA256SUMS-Gom-0.8.2-windows.txt`

Mac dùng chữ ký ad-hoc, chưa có Apple Developer ID và chưa notarize; cập nhật bằng DMG tải thủ công. Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app.

## Giới hạn bằng chứng

Các lượt tính năng đã có dùng profile/home/userData tạm, trang giả, crypto và native-notification doubles tại ranh giới hệ điều hành; store, service, bridge, callbacks và native view chạy thật. Chúng chưa xác nhận banner/quyền thông báo, keychain thực hoặc runtime Windows của bản 0.8.2. Không dùng dữ liệu phiên hoặc tài khoản thật của người dùng để kiểm thử. Kết quả cài đặt sẽ được ghi riêng sau khi hoàn tất, không suy ra từ kiểm tra gói.
