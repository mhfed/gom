# Phân phối Gom bằng DMG và cập nhật thủ công

Bản 0.6.1 tạo bộ cài **macOS Apple Silicon (arm64)**. Chưa có bản Intel hoặc Universal. Ứng dụng ký ad-hoc để chạy trên máy Mac, chưa ký bằng Apple Developer ID và chưa notarize. DMG không làm thay đổi giới hạn này.

Bản 0.6.1 đã được phát hành tại [GitHub Releases](https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.6.1), gồm DMG, ZIP, file tương thích TinNhan và checksum.

## Cài đặt và gửi cho người khác

1. Gửi file `Gom-macOS-arm64-0.6.1.dmg` cùng file SHA-256, hoặc gửi đường dẫn GitHub Release sau khi người duy trì phát hành.
2. Người nhận mở DMG rồi kéo **Gom.app** vào **Applications**.
3. Eject ổ đĩa Gom, mở ứng dụng từ Applications. Tránh chạy trực tiếp trong DMG.
4. Nếu macOS chặn vì chưa xác minh nhà phát triển, chỉ khi đã tin cậy nguồn tải: thử mở app trước, vào **System Settings → Privacy & Security → Open Anyway**, rồi xác nhận **Open**. Máy do tổ chức quản lý có thể không cho phép thao tác này. Xem [hướng dẫn chính thức của Apple](https://support.apple.com/en-us/102445).

Không cần tắt Gatekeeper toàn hệ thống. Nếu thông báo nói ứng dụng hỏng hoặc có mã độc, kiểm tra lại nguồn tải và SHA-256 thay vì bỏ qua cảnh báo.

Gói chỉ chứa chương trình và tài nguyên hiển thị. Người nhận đăng nhập tài khoản của riêng mình; gói không chứa cookie, hồ sơ Chrome, tài khoản hay lịch sử chat của máy build.

## Kiểm tra và cài bản mới

Trong **Cài đặt → Cập nhật**, bấm **Kiểm tra cập nhật**. Cũng có thể mở mục này từ menu **Gom → Kiểm tra cập nhật…**. Khi tìm thấy bản ổn định mới có gói tương thích, nút **Tải bản mới** mở trang GitHub Release trong trình duyệt. App không tự tải chương trình, cài thay thế hoặc khởi động lại.

Bản đóng gói mặc định kiểm tra sau 30 giây khởi động và mỗi 12 giờ khi đang chạy. Có thể tắt trong mục Cập nhật. Nguồn là [GitHub Releases của mhfed/tin-nhan-desktop](https://github.com/mhfed/tin-nhan-desktop/releases); không cần tài khoản GitHub hay token. Lỗi mạng, giới hạn lượt truy cập và chưa có gói tương thích được hiển thị riêng, không báo nhầm rằng đang dùng bản mới nhất.

Để nâng cấp, lưu hoặc sao chép bản nháp quan trọng, thoát Tin Nhan/Gom bằng **⌘Q**, rồi kéo **Gom.app** vào Applications. Nếu đã có Gom, chọn thay thế. Khi nâng cấp từ Tin Nhan lần đầu, tên file app thay đổi nên macOS không tự thay `Tin Nhan.app`; sau khi kiểm tra Gom, có thể bỏ bản app Tin Nhan cũ khỏi Applications. Giữ nguyên thư mục `~/Library/Application Support/TinNhanDesktop`. App mới dùng lại dữ liệu cũ; phiên đăng nhập vẫn phụ thuộc thời hạn và chính sách của từng nền tảng. Bản nháp giữ nguyên khi chuyển tab trong app, còn khôi phục sau thoát phụ thuộc Zalo, Telegram hoặc Messenger.

Tên nội bộ dùng cho khóa mã hóa macOS vẫn là `Tin Nhan`; bundle ID, thư mục dữ liệu và partition không đổi. Chữ ký vẫn là ad-hoc, nên macOS có thể yêu cầu quyền Keychain khi mở bản mới. Không xóa hoặc tạo lại khóa `Tin Nhan Safe Storage`.

Nếu trước đây bật chạy cùng máy cho Tin Nhan, kiểm tra **System Settings → General → Login Items** và bỏ mục app Tin Nhan cũ; bật lại **Mở Gom khi đăng nhập** trong Gom nếu muốn. Bộ cài không tự thay đổi mục đăng nhập macOS.

Việc cập nhật phiên bản không đồng bộ cookie hoặc tài khoản giữa các máy. Mỗi người dùng giữ dữ liệu của mình trên máy của họ.

## Tạo gói phát hành

Chạy trên macOS Apple Silicon với Node.js 24+:

```sh
npm ci
npm run typecheck
npm test
npm run make
```

Electron Forge tạo cả hai định dạng bằng cùng app bundle:

- DMG: `out-release/make/dmg/arm64/Gom-macOS-arm64-0.6.1.dmg`
- ZIP: `out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.6.1.zip`
- App: `out-release/Gom-darwin-arm64/Gom.app`

Cấu hình `forge.config.cjs` chỉ đưa `package.json` và các file runtime đã liệt kê trong `dist/` vào app. Mỗi khi thêm tài nguyên runtime phải cập nhật danh sách này. Source nghiên cứu, hồ sơ người dùng, kết quả kiểm thử, `node_modules` và các bản build cũ đều nằm ngoài danh sách. Kiểm tra lại nội dung `app.asar` trước khi phân phối.

Trước khi gửi, kiểm tra chữ ký ad-hoc của app bằng `codesign --verify --deep --strict`, chạy `hdiutil verify` với DMG và kiểm tra ZIP. Mount DMG ở chế độ chỉ đọc để xác nhận có `Gom.app` cùng liên kết Applications; không mở app từ DMG để kiểm thử bằng hồ sơ cá nhân.

Sao chép gói đã kiểm chứng sang tên phát hành thống nhất và tạo checksum:

```sh
mkdir -p outputs
cp out-release/make/dmg/arm64/Gom-macOS-arm64-0.6.1.dmg outputs/
cp 'out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.6.1.zip' outputs/Gom-macOS-arm64-0.6.1.zip
cp outputs/Gom-macOS-arm64-0.6.1.dmg outputs/TinNhan-macOS-arm64-0.6.1.dmg
cd outputs
shasum -a 256 Gom-macOS-arm64-0.6.1.dmg Gom-macOS-arm64-0.6.1.zip TinNhan-macOS-arm64-0.6.1.dmg > SHA256SUMS-Gom-0.6.1.txt
```

## Phát hành trên GitHub

Build cục bộ không tự xuất bản Release. Khi sẵn sàng phân phối, người duy trì tạo một **Release ổn định**, tag `v0.6.1`, trong đúng repository `mhfed/tin-nhan-desktop`, kèm ghi chú thay đổi và các file:

- `Gom-macOS-arm64-0.6.1.dmg`
- `Gom-macOS-arm64-0.6.1.zip`
- `SHA256SUMS-Gom-0.6.1.txt`
- `TinNhan-macOS-arm64-0.6.1.dmg` — bản sao tương thích, nội dung giống hệt DMG Gom, dành cho bộ kiểm tra cập nhật của Tin Nhan 0.5.4.

Gom nhận cả tên gói Gom và TinNhan cũ. Tin Nhan 0.5.4 chỉ nhận tên cũ, nên cần tải lên asset tương thích ở trên để người dùng cũ được thông báo có bản mới. Tạo bằng `cp outputs/Gom-macOS-arm64-0.6.1.dmg outputs/TinNhan-macOS-arm64-0.6.1.dmg` và đưa cả file này vào checksum. Đây vẫn là bundle Gom, không phải bản chương trình khác.

Tag phải khớp version trong `package.json`; tên gói cần chứa version và kiến trúc. Chỉ đăng bản ổn định sau khi có đủ gói đã kiểm chứng. Bộ kiểm tra bỏ qua draft/prerelease; bản cài mới hơn bản public sẽ thông báo rõ tình trạng đó. Các bản sau tăng version và lặp lại quy trình. Bản cũ chỉ nhận thông báo cập nhật nếu đã có tính năng này từ 0.5.4 trở đi.

## Công cụ đóng gói

Sử dụng [Electron Forge DMG maker](https://www.electronforge.io/config/makers/dmg) 8.0.1, cùng phiên bản với Forge CLI. Kiểm tra dependency ngày 26/10/2026: `npm audit` báo một cảnh báo DoS của bộ đọc ICNS `image-size`, lan qua bốn package trong chuỗi `maker-dmg → electron-installer-dmg → appdmg → image-size`; chưa có bản sửa tương thích mà npm đề xuất. Chỉ dùng ảnh nền/icon cục bộ đã kiểm soát trong quá trình build. Chuỗi này là dependency phát triển, không được đưa vào `app.asar` và không chạy trên máy người nhận. Xem [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) khi cập nhật công cụ.
