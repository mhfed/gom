# Kiểm chứng Gom 0.8.1

[Gom 0.8.1](https://github.com/mhfed/gom/releases/tag/v0.8.1) đã phát hành cho Mac Apple Silicon và Windows x64 ngày **29/10/2026**, lúc `2026-10-29T09:16:49Z` (**16:16:49** giờ Việt Nam). Không cài hoặc thay ứng dụng trên máy người dùng trong đợt phát hành này.

## Mã nguồn

- Typecheck và **212/212 unit test** đạt trên nguồn phát hành cuối.
- Lượt kiểm chứng tính năng trước khi đóng gói đạt **10 nhóm Khay**, **16 nhóm native tabs**, **17 nhóm Không gian kín** và **12 nhóm chat nổi**. Kết quả native tabs thuộc mã nguồn; không có lượt 16 nhóm native tabs trên gói đóng sẵn trong đợt này.
- Nguồn tạo gói ở commit `1772a68` được đối chiếu tương đương với nguồn tại tag `v0.8.1`, commit `5efa663`.

Chi tiết các trường hợp RED/GREEN và phạm vi rà soát tính năng: [kiểm chứng Khay](verification-transfer-shelf.md), [bản sửa popup](floating-mobile-fix.md).

## Mac Apple Silicon

- Build arm64, chữ ký ad-hoc, DMG và ZIP đạt kiểm tra. **23 file runtime** trong ASAR khớp bản build.
- **10 nhóm Khay**, **17 nhóm Không gian kín** và **12 nhóm chat nổi** đạt trên ASAR đóng gói.
- Mount DMG chỉ đọc xác nhận version, ASAR, liên kết Applications và launcher. ZIP được kiểm tra cùng gói ứng dụng.
- Mac chưa có chữ ký Apple Developer ID và chưa notarize; cập nhật bằng DMG tải thủ công.

## Windows x64

- [Windows CI 40847500539](https://github.com/mhfed/gom/actions/runs/40847500539), job `123358504075`: thành công; **118 test đạt, 0 test bỏ qua**.
- Setup, `.nupkg` và `RELEASES` được tạo và kiểm tra. **23 file runtime** trong ASAR khớp bản build; payload Squirrel khớp payload ứng dụng.
- **10 nhóm Khay**, **17 nhóm Không gian kín** và **12 nhóm chat nổi** đạt trên ASAR đóng gói Windows.
- Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app.

## Asset phát hành và checksum

Đủ **bảy asset** trên GitHub Release 0.8.1; SHA-256 của cả bảy khớp manifest theo nền tảng:

- Mac: [DMG](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-macOS-arm64-0.8.1.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-macOS-arm64-0.8.1.zip), [manifest SHA-256](https://github.com/mhfed/gom/releases/download/v0.8.1/SHA256SUMS-Gom-0.8.1-macos.txt).
- Windows: [Setup](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-win32-x64-0.8.1-Setup.exe), [gói Squirrel](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom_win32_x64-0.8.1-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.1/RELEASES), [manifest SHA-256](https://github.com/mhfed/gom/releases/download/v0.8.1/SHA256SUMS-Gom-0.8.1-windows.txt).

## Giới hạn bằng chứng

Fixture dùng profile, tài khoản, clipboard, hộp thoại, safeStorage, tệp và trang giả; store, bridge, callback và native view của Gom chạy thật. Các lượt này không xác nhận keychain/hộp thoại thực hoặc việc dán trên tài khoản nền tảng thật. Không dùng userData hay tài khoản đang đăng nhập của người dùng để kiểm thử. Khả năng từng nền tảng chọn giao diện mobile hoặc giữ bản nháp sau lần tải lại ban đầu vẫn phụ thuộc website.
