# Tin Nhan 0.5.4 — DMG và kiểm tra cập nhật

Thêm bộ cài DMG cho Mac Apple Silicon, với Tin Nhan.app và lối tắt Applications. Vẫn cung cấp ZIP. Chữ ký ad-hoc, chưa có Developer ID hoặc notarization; xem [hướng dẫn cài, chia sẻ và phát hành](distribution.md).

## Thay đổi

- Cài đặt → Cập nhật và menu Tin Nhan → Kiểm tra cập nhật. Hiển thị phiên bản, trạng thái, thời điểm kiểm tra và ghi chú phát hành dạng văn bản.
- Nút Tải bản mới mở trang GitHub Release để người dùng tự cài. Không tự tải chương trình, thay app hoặc khởi động lại.
- Bản đóng gói kiểm tra sau 30 giây và mỗi 12 giờ. Một timer; giữ thời điểm đến hạn qua sleep/wake. Có tùy chọn tắt được lưu qua lần mở lại. Bản dev không kiểm tra nền.
- Nguồn cố định `mhfed/tin-nhan-desktop`; yêu cầu HTTPS không cookie/token, timeout 10 giây cả body, giới hạn 512 KiB, gộp yêu cầu đồng thời. Kiểm tra stable semver, kiến trúc, version trong tên gói và URL đúng repo. Lỗi mạng, rate limit, chưa có gói tương thích, bản cục bộ mới hơn bản public đều có trạng thái riêng.
- Allowlist gói chỉ gồm package.json và 11 file runtime trong dist. Source nghiên cứu, dependency, dữ liệu tài khoản và kết quả kiểm thử không nằm trong app.

Giữ nguyên bundle ID, đường dẫn userData và partition. Giữ giao diện chat riêng từng nền tảng, tối ưu nền và sửa lỗi Secure Input của 0.5.3. Mở kiểm tra/tải bản mới không tải lại trang chat. Khôi phục bản nháp sau khi thoát app để cài vẫn phụ thuộc nền tảng.

## Kiểm chứng ngày 26/10/2026

- `npm run typecheck`: PASS; `npm test`: 121/121 PASS, gồm 25 ca checker, 5 ca lịch kiểm tra và ca lưu tùy chọn.
- `scripts/manual-updates-check.mjs`: 9/9 nhóm PASS. Node fetch giả lập API cố định; HTTPS giả và hồ sơ tạm. Chứng minh dev sau 31 giây không gọi API, một request cho nhiều lần bấm, ghi chú HTML hiện chữ thuần, URL tải cố định, các lỗi/phiên bản báo đúng, IPC từ trang dịch vụ bị từ chối, form tài khoản không bị menu che, tùy chọn tắt giữ qua thoát/mở lại. Ba view và bản nháp giữ nguyên. Kết quả: `outputs/manual-updates/result.json`.
- Native tabs: 11/11 PASS, bốn trang/bản nháp giữ nguyên. Những lượt đầu bị mất foreground macOS tại các bước khác nhau; chạy lại riêng đã qua toàn bộ, không thay đổi mã production hoặc nới điều kiện focus.
- Command focus, renderer performance, persistence write/read và window lifecycle: PASS. Không có DOM mutation khi render cùng trạng thái.
- Thử checker thật với GitHub công khai: local 0.5.4, latest v0.5.0 → `ahead`, đúng trạng thái. Không xuất bản Release mới trong lượt này.
- `npm run make`: PASS. ZIP integrity, DMG checksum, chữ ký app deep/strict, version 0.5.4, arm64 và bundle ID `local.mhfed.tinnhan.desktop`: PASS.
- Mount DMG chỉ đọc: có Tin Nhan.app và Applications → /Applications. ASAR trong DMG khớp bundle; 11 file runtime trong ASAR khớp chính build đã kiểm thử. Tháo volume sau kiểm tra.

Không dùng hồ sơ cá nhân, không gửi tin, không cài đè app đang dùng. Kiểm tra cơ chế EVKey native 37 ca của 0.5.3 không chạy lại vì Electron và workaround không đổi; các unit test workaround vẫn qua. Không đo lại CPU/RAM thực tế trong lượt bổ sung cập nhật này.

## Artifact

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `outputs/TinNhan-macOS-arm64-0.5.4.dmg` | 117965417 | `e77f21bf99c806e4eed3d753c4738257d1841822567d1074d3f20e71ffa27294` |
| `outputs/TinNhan-macOS-arm64-0.5.4.zip` | 119795288 | `2731f41ab20518cd2ba5fed2ad98d6bb6d58a5c5075f63eac8e5b0617cd2d52b` |

Checksum: `outputs/SHA256SUMS-0.5.4.txt`. Inventory/hash và kiểm tra mount: `outputs/TinNhan-0.5.4/package-verification.json`, `dmg-verification.json`.

GitHub vẫn công bố 0.5.0. Người nhận có thể cài DMG 0.5.4 trực tiếp; thông báo cập nhật các bản sau hoạt động khi người duy trì đăng Release ổn định mới kèm gói tương thích. Công cụ build DMG có cảnh báo dependency phát triển được ghi trong distribution.md; dependency này không được đóng gói vào ứng dụng.
