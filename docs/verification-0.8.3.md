# Kiểm chứng Gom 0.8.3

Bản chuẩn bị phát hành từ nhánh `codex/header-compact`, gồm Tập trung, Quản lý tài nguyên, Sao lưu cấu hình và header B. Chỉ công bố release sau khi kiểm tra gói Mac/Windows và các checksum đạt.

## Phạm vi

- Toàn bộ unit test và typecheck trên source 0.8.3.
- Mac arm64: app, DMG, ZIP; chữ ký deep/strict; 23 file runtime ASAR khớp build; chạy Header, Focus, Resource và Backup từ ASAR bằng profile tạm.
- Windows x64: toàn bộ unit test, Squirrel Setup/`.nupkg`/`RELEASES`; đối chiếu ASAR/payload và tám nhóm fixture đóng gói qua workflow `Windows release assets`.
- Kiểm tra đủ bảy asset Mac/Windows, digest và checksum trước khi công bố.

Các kiểm chứng tính năng trước đóng gói: [Tập trung](verification-timed-focus.md), [Tài nguyên](verification-resource-management.md), [Sao lưu](verification-configuration-backup.md), [Header](verification-header-compact.md). Hồ sơ, cookie, nội dung chat thật và kết quả kiểm thử không được đưa vào package.

Kết quả và liên kết CI được cập nhật từ lần chạy thực tế; chưa coi trạng thái đang chờ là đạt.

## Kết quả Mac trước khi tạo tag

Typecheck và **295/295 unit test**, không bỏ qua, đạt trên source 0.8.3. `npm run make` tạo app, DMG và ZIP arm64. Chữ ký deep/strict, DMG checksum, ZIP CRC và **23 file runtime** ASAR khớp bản build đều đạt.

Các fixture trên ASAR dùng hồ sơ/trang giả: **12 Header**, **18 Focus**, **13 Resource**, **8 Backup**, **17 Không gian kín**, **12 chat nổi**, **10 Khay**, **15 Nhắc trả lời** đều đạt. Các GUI fixture chạy tuần tự.

Windows được kiểm tra bằng workflow cho tag v0.8.3; bước tải asset chỉ chạy sau toàn bộ gate và chỉ cho draft release. Kết quả remote và digest sẽ được đối chiếu trước khi xuất bản.
