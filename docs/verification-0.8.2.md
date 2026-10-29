# Kiểm chứng Gom 0.8.2

[Gom 0.8.2](https://github.com/mhfed/gom/releases/tag/v0.8.2) đã phát hành ngày **29/10/2026**, lúc `2026-10-29T10:41:40Z` (**17:41:40** giờ Việt Nam), là bản ổn định mới nhất tại thời điểm kiểm chứng. Bản Mac đã được cài và mở trên máy theo yêu cầu.

## Mã nguồn

- Typecheck và **248/248 unit test** đạt trên nguồn phiên bản 0.8.2, không bỏ qua bài nào.
- Tính năng hoàn thiện ở commit `57fa5b8`; nguồn chuẩn bị gói tại `8146419` khớp toàn bộ cây nguồn của tag `v0.8.2`, commit merge `451548127880c0ae04a1057cea5066b91abe6a7f` ([PR #11](https://github.com/mhfed/gom/pull/11)).
- Trước khi nâng phiên bản, hồi quy mã nguồn đạt **15 nhóm Nhắc trả lời**, **16 kiểm tra native tabs**, **17 kiểm tra Không gian kín**, **12 nhóm chat nổi** và **10 nhóm Khay**. Lượt 16 native tabs thuộc mã nguồn, không phải gói đóng sẵn.

Chi tiết thiết kế, lỗi đã sửa và giới hạn: [kiểm chứng Nhắc trả lời](verification-reply-reminders.md).

## Mac Apple Silicon

- `npm run make` tạo app arm64, DMG và ZIP. Chữ ký ad-hoc qua deep/strict; **23 file runtime** trong ASAR khớp bản build.
- Trên ASAR đóng gói, **15 nhóm Nhắc trả lời**, **10 nhóm Khay**, **17 kiểm tra Không gian kín** và **12 nhóm chat nổi** đạt; các fixture chạy tuần tự.
- DMG qua kiểm tra checksum và mount chỉ đọc: version/bundle ID, ASAR, liên kết Applications, launcher executable và cú pháp bash đều đúng. Chữ ký app trên DMG hợp lệ; volume đã tháo sạch.
- ZIP qua kiểm tra toàn vẹn; version và ASAR khớp app/DMG.
- ASAR Mac SHA-256: `0dfe6e4a02ed60f2c352a69115abb4c96afe3f6100c5992678816c3328ee5dd2`.

## Windows x64

- [Windows CI 40858604481](https://github.com/mhfed/gom/actions/runs/40858604481), job `123395802023`: thành công, toàn bộ 19 bước đạt; **154/154 test đạt, 0 test bỏ qua**.
- Setup, `.nupkg` và `RELEASES` được tạo; SHA-1/kích thước Squirrel đúng. **23 file runtime** trong ASAR khớp bản build; ASAR trong payload cập nhật khớp app đã kiểm thử.
- ASAR đóng gói đạt **17 kiểm tra Không gian kín**, **12 nhóm chat nổi**, **10 nhóm Khay** và **15 nhóm Nhắc trả lời** trước khi upload.

## Asset phát hành

Đủ **bảy asset** được tải lên bản nháp rồi mới công bố. SHA-256 do GitHub cung cấp khớp hai manifest tải lại từ release; toàn bộ tệp Mac khớp bản cục bộ đã kiểm chứng. Metadata Squirrel/payload được xác minh trong CI. Cả bảy đường tải công khai trả HTTP 200 sau khi theo redirect.

- Mac: [DMG](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-macOS-arm64-0.8.2.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-macOS-arm64-0.8.2.zip), [manifest](https://github.com/mhfed/gom/releases/download/v0.8.2/SHA256SUMS-Gom-0.8.2-macos.txt).
- Windows: [Setup](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom-win32-x64-0.8.2-Setup.exe), [Squirrel](https://github.com/mhfed/gom/releases/download/v0.8.2/Gom_win32_x64-0.8.2-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.2/RELEASES), [manifest](https://github.com/mhfed/gom/releases/download/v0.8.2/SHA256SUMS-Gom-0.8.2-windows.txt).

## Cài trên máy

- Đã sao lưu và kiểm tra toàn vẹn app **0.8.0** trước khi thay thế; giữ cả ZIP và bundle cũ trong thư mục bằng chứng cục bộ của 0.8.2.
- Thoát app cũ nhẹ nhàng, kiểm tra bundle mới ở staging rồi thay `/Applications/Gom.app` và mở lại **0.8.2**. Version, bundle ID, chữ ký và SHA-256 ASAR đã cài khớp gói Mac nêu trên.
- Bộ cài không xóa hay đổi thư mục dữ liệu tài khoản. Giữ bundle ID `local.mhfed.tinnhan.desktop`, tên Keychain, `TinNhanDesktop` và partition hiện có.

## Giới hạn

Fixture dùng profile/home/userData tạm, trang, clipboard, hộp thoại, safeStorage và thông báo giả ở ranh giới hệ điều hành. Store, service, bridge và native view chạy thật trên Mac và Windows. Không dùng tài khoản hay nội dung chat thật để kiểm thử; chưa xác nhận banner/quyền thông báo, Keychain thực hoặc thao tác dán trên nền tảng thật. Kiểm tra cài đặt chỉ xác nhận bundle/version/chữ ký/hash và tiến trình đã mở.

Mac ký ad-hoc, chưa có Apple Developer ID/notarization; Windows chưa ký Authenticode. Bản Mac cập nhật thủ công qua DMG, Windows dùng Squirrel. Khả năng từng website chọn bố cục mobile hoặc giữ bản nháp sau lần tải lại đầu vẫn phụ thuộc nền tảng.
