# Kiểm chứng Gom 0.8.1

Trạng thái: **đang chuẩn bị bản phát hành** ngày 29/10/2026. Chưa xác nhận đã công bố hoặc cài 0.8.1 trên máy người dùng. Các kết quả mã nguồn đã có dưới đây được ghi nhận từ lượt kiểm chứng tính năng trước khi đóng gói; chúng không thay thế kiểm tra lại trên gói 0.8.1.

## Bằng chứng mã nguồn đã có

- Typecheck và **211/211 unit test** đạt.
- Electron Khay: **10 nhóm đạt**, gồm persistence, chữ/link/ảnh/tệp, hai không gian, callback cũ và thoát giữa lúc xuất file.
- Native tabs: **16 nhóm đạt**, gồm giữ native page/bản nháp và không đổi DOM khi snapshot giữ nguyên.
- Không gian kín: **17 nhóm đạt**; chat nổi: **12 nhóm đạt**, gồm reload một lần tại viewport popup, thu/mở không reload và bong bóng 36 px.
- Rà soát độc lập phạm vi Khay và bản sửa popup không còn P1/P2 chưa xử lý tại thời điểm lượt kiểm chứng đó.

Chi tiết, các trường hợp RED/GREEN và giới hạn fixture: [kiểm chứng Khay](verification-transfer-shelf.md), [bản sửa popup](floating-mobile-fix.md). Fixture dùng profile, tài khoản, clipboard, hộp thoại, safeStorage, tệp và trang giả; không xác nhận keychain/hộp thoại thực hoặc việc dán trên tài khoản nền tảng thật.

## Kiểm tra gói 0.8.1 còn chờ

| Hạng mục                                                             | Trạng thái                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Typecheck và unit suite trên nguồn phát hành cuối                    | Đạt: 212/212, gồm fixture Windows có thể bỏ qua symlink khi OS từ chối quyền |
| Mac arm64: build, ASAR khớp runtime, DMG, ZIP, chữ ký ad-hoc         | Chờ xác nhận                                                                 |
| Mac: Khay 10, Không gian kín 17, chat nổi 12 nhóm trên ASAR đóng gói | Chờ xác nhận                                                                 |
| Mac: mount DMG chỉ đọc, version, ASAR, Applications link và launcher | Chờ xác nhận                                                                 |
| Windows x64: CI, Setup, `.nupkg`, `RELEASES` và ASAR khớp runtime    | Chờ xác nhận                                                                 |
| Windows: fixture Khay, Không gian kín và chat nổi trên ASAR đóng gói | Chờ xác nhận                                                                 |
| SHA-256, metadata Squirrel, manifest và đối chiếu asset phát hành    | Chờ xác nhận                                                                 |
| Công bố GitHub Release và kiểm tra tải xuống                         | Chờ xác nhận                                                                 |
| Cài đặt hoặc mở bản 0.8.1 tại máy người dùng                         | Chưa xác nhận                                                                |

## Gói dự kiến

Mac: `Gom-macOS-arm64-0.8.1.dmg`, `Gom-macOS-arm64-0.8.1.zip`, `SHA256SUMS-Gom-0.8.1-macos.txt`.

Windows: `Gom-win32-x64-0.8.1-Setup.exe`, `Gom_win32_x64-0.8.1-full.nupkg`, `RELEASES`, `SHA256SUMS-Gom-0.8.1-windows.txt`.

Mac ký ad-hoc, chưa notarize. Windows chưa ký Authenticode. Tài liệu này sẽ được cập nhật bằng kết quả thực tế khi từng bước hoàn tất.
