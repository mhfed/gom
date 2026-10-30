# Kiểm chứng Gom 0.8.3

[Gom 0.8.3](https://github.com/mhfed/gom/releases/tag/v0.8.3) đã phát hành ngày **30/10/2026**, lúc `2026-10-30T09:44:31Z` (**16:44:31** giờ Việt Nam), là bản ổn định mới nhất tại thời điểm kiểm chứng. Bản Mac 0.8.3 đã được cài và mở trên máy theo yêu cầu.

## Mã nguồn

- [PR #12](https://github.com/mhfed/gom/pull/12) đã merge vào `main` tại `fd111fa90b5e9a4b7a05e9cb24d36c3cc9371299`.
- Tag `v0.8.3` giữ nguyên tại `0d605a18cf1d1e490ca751e11e4e4e83fc1bcc20`. Mã runtime và package manifest không đổi sau khi tạo tag.
- Công cụ/fixture kiểm chứng Windows tại `90089c42e7d3144e97d66ee4185dfc3dfee22edb`; workflow nạp các file kiểm chứng từ revision này trong khi đóng gói source của tag. Các thay đổi giải quyết SQLite fixture, bit quyền Unix và hành vi thay thế tệp có reader trên Windows; không sửa runtime hay viết lại tag.
- Typecheck và **295/295 unit test**, **0 bỏ qua**, đạt trên Mac, Windows và lượt Mac sau merge. Cây nguồn sau merge khớp cây đã kiểm chứng.

## Gói Mac Apple Silicon

`npm run make` tạo app arm64, DMG và ZIP. Chữ ký ad-hoc deep/strict, DMG checksum và ZIP CRC đạt; **23 file runtime** ASAR khớp bản build. Mount DMG chỉ đọc xác nhận version, bundle ID, ASAR, liên kết Applications, launcher executable/cú pháp bash và chữ ký. Volume đã được tháo.

ASAR Mac SHA-256: `406f9e22459575b9fc34f334735adaa49c6dafb53a0a445bb8b22e469c0aa494`.

## Gói Windows x64

[Windows CI 41033410670](https://github.com/mhfed/gom/actions/runs/41033410670), job `123988324095`, thành công với toàn bộ **23 bước**. Setup, `.nupkg` và `RELEASES` được tạo; SHA-1/kích thước Squirrel đúng. **23 file runtime** ASAR khớp bản build; ASAR trong payload cập nhật khớp app đã kiểm thử.

## Kiểm thử gói trên cả hai nền tảng

Mọi fixture dùng appData/home tạm và trang giả, chạy tuần tự, không dùng tài khoản thật.

| Fixture từ ASAR    | Mac | Windows |
| ------------------ | --- | ------- |
| Header gọn         | 12  | 12      |
| Tập trung          | 18  | 18      |
| Quản lý tài nguyên | 13  | 13      |
| Sao lưu cấu hình   | 8   | 8       |
| Không gian kín     | 17  | 17      |
| Chat nổi           | 12  | 12      |
| Khay               | 10  | 10      |
| Nhắc trả lời       | 15  | 15      |

Chi tiết tính năng: [Tập trung](verification-timed-focus.md), [Tài nguyên](verification-resource-management.md), [Sao lưu](verification-configuration-backup.md), [Header](verification-header-compact.md).

## Asset, công bố và cài đặt

Đủ **bảy asset** Mac/Windows được đối chiếu bằng digest SHA-256 của GitHub với manifest và tệp cục bộ khi có. Hai manifest tự khớp digest của chính chúng. Release được chuyển khỏi draft và đánh dấu latest stable sau khi mọi gate đạt.

- Mac: [DMG](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-macOS-arm64-0.8.3.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-macOS-arm64-0.8.3.zip), [checksum](https://github.com/mhfed/gom/releases/download/v0.8.3/SHA256SUMS-Gom-0.8.3-macos.txt).
- Windows: [Setup.exe](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-win32-x64-0.8.3-Setup.exe), [nupkg](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom_win32_x64-0.8.3-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.3/RELEASES), [checksum](https://github.com/mhfed/gom/releases/download/v0.8.3/SHA256SUMS-Gom-0.8.3-windows.txt).

Bản cài `/Applications/Gom.app` có version **0.8.3**, bundle ID `local.mhfed.tinnhan.desktop`, chữ ký hợp lệ và ASAR trùng gói đã kiểm chứng. App cũ được giữ trong thư mục output cục bộ để khôi phục. Không đưa hồ sơ, cookie hoặc nội dung chat cá nhân vào gói hay Git. Bản Mac ký ad-hoc/chưa notarize; Windows chưa ký Authenticode.
