# Phân phối Gom bằng DMG và cập nhật thủ công

Bản 0.7.5 tạo bộ cài **macOS Apple Silicon (arm64)**. Chưa có bản Intel hoặc Universal. Ứng dụng ký ad-hoc để chạy trên máy Mac, chưa ký bằng Apple Developer ID và chưa notarize. DMG không làm thay đổi giới hạn này.

Bản 0.7.5 gồm DMG, ZIP và checksum tại [GitHub Releases](https://github.com/mhfed/gom/releases/tag/v0.7.5).

## Cài đặt và gửi cho người khác

1. Gửi file `Gom-macOS-arm64-0.7.5.dmg` cùng file SHA-256, hoặc gửi đường dẫn GitHub Release sau khi người duy trì phát hành.
2. Người nhận mở DMG rồi kéo **Gom.app** vào **Applications**.
3. Eject ổ đĩa Gom, mở ứng dụng từ Applications. Tránh chạy trực tiếp trong DMG.
4. Lần đầu mở, macOS có thể báo “Apple could not verify Gom is free of malware” vì app chưa notarize. Chỉ khi đã tin cậy nguồn tải, chọn một trong hai cách:
   - **Cách nhanh:** sau khi kéo Gom.app vào Applications, bấm đúp **Mo-Gom.command** trong DMG. Script gỡ cờ cách ly của `Gom.app` rồi mở app. Nếu chính file này bị chặn, bấm **Done**, rồi dùng cách bên dưới cho file đó, hoặc chạy `xattr -dr com.apple.quarantine /Applications/Gom.app` trong Terminal.
   - **Cách thủ công:** bấm **Done** (không chọn Move to Trash), vào **System Settings → Privacy & Security**, kéo xuống mục Security, bấm **Open Anyway** cạnh dòng “Gom was blocked”, nhập mật khẩu rồi xác nhận **Open**.

   Máy do tổ chức quản lý có thể không cho phép các thao tác này. Xem [hướng dẫn chính thức của Apple](https://support.apple.com/en-us/102445).

Không cần tắt Gatekeeper toàn hệ thống. Nếu thông báo nói ứng dụng hỏng hoặc có mã độc, kiểm tra lại nguồn tải và SHA-256 thay vì bỏ qua cảnh báo.

Gói chỉ chứa chương trình và tài nguyên hiển thị. Người nhận đăng nhập tài khoản của riêng mình; gói không chứa cookie, hồ sơ Chrome, tài khoản hay lịch sử chat của máy build.

## Kiểm tra và cài bản mới

Repository đã đổi tên thành `mhfed/gom`. Bộ kiểm tra của các bản 0.6.0 trở về trước từ chối chuyển hướng từ địa chỉ cũ; tải DMG trực tiếp từ Release để nâng cấp lần này. Từ bản 0.6.2, app đã dùng nguồn mới và tiếp tục kiểm tra chính xác địa chỉ phát hành.

Trong **Cài đặt → Cập nhật**, bấm **Kiểm tra cập nhật**. Cũng có thể mở mục này từ menu **Gom → Kiểm tra cập nhật…**. Khi tìm thấy bản ổn định mới có gói tương thích, nút **Tải bản mới** mở trang GitHub Release trong trình duyệt. App không tự tải chương trình, cài thay thế hoặc khởi động lại.

Bản đóng gói mặc định kiểm tra sau 30 giây khởi động và mỗi 12 giờ khi đang chạy. Có thể tắt trong mục Cập nhật. Nguồn là [GitHub Releases của mhfed/gom](https://github.com/mhfed/gom/releases); không cần tài khoản GitHub hay token. Lỗi mạng, giới hạn lượt truy cập và chưa có gói tương thích được hiển thị riêng, không báo nhầm rằng đang dùng bản mới nhất.

### Tự cập nhật

Mã nguồn có nhánh Electron `autoUpdater` để tải ZIP trong app, hiện tiến độ và cài sau khi người dùng chọn khởi động lại. Bản phát hành 0.7.5 này ký ad-hoc vì máy build chưa có chứng chỉ và thông tin notarize, nên nút tải sẽ mở GitHub Release để cài thủ công. Bản 0.7.2 cũng cần nâng cấp thủ công một lần.

Để tạo bản phát hành tự cập nhật, cài chứng chỉ **Developer ID Application** vào Keychain của máy build, rồi truyền `GOM_MACOS_SIGNING_IDENTITY`, `GOM_APPLE_ID`, `GOM_APPLE_APP_SPECIFIC_PASSWORD` và `GOM_APPLE_TEAM_ID` vào `npm run make`. Không ghi chứng chỉ, app-specific password hay thông tin tài khoản vào Git. Giữ cùng Developer ID cho các phiên bản tiếp theo.

Chữ ký xác nhận nhà phát hành và tính toàn vẹn của app; không cấp cho app quyền đọc thêm tài khoản hoặc nội dung chat. Khi chuyển từ app ad-hoc sang Developer ID lần đầu, macOS có thể hỏi quyền Keychain lại. Bundle ID, tên Keychain hiện dùng (`Tin Nhan`), thư mục `TinNhanDesktop` và partition phiên đăng nhập vẫn được giữ nguyên.

Để nâng cấp, lưu hoặc sao chép bản nháp quan trọng, thoát app đang dùng bằng **⌘Q**, rồi kéo **Gom.app** vào Applications. Nếu đã có Gom, chọn thay thế. Khi nâng cấp lần đầu, macOS có thể giữ app cũ riêng vì tên đã đổi; sau khi kiểm tra Gom, có thể gỡ app cũ khỏi Applications. Giữ nguyên thư mục `~/Library/Application Support/TinNhanDesktop`. App mới dùng lại dữ liệu cũ; phiên đăng nhập vẫn phụ thuộc thời hạn và chính sách của từng nền tảng. Bản nháp giữ nguyên khi chuyển tab trong app, còn khôi phục sau thoát phụ thuộc Zalo, Telegram hoặc Messenger.

Bản 0.7.0 đọc catalog cũ và lưu catalog v2 khi thay đổi tài khoản hoặc thêm website. Các bản 0.6.x không đọc được catalog v2, kể cả bản backup sau khi lưu. Sau khi nâng cấp nên tiếp tục dùng 0.7.x hoặc mới hơn; không xóa thư mục dữ liệu để hạ phiên bản.

Tên nội bộ dùng cho khóa mã hóa macOS vẫn là `Tin Nhan`; bundle ID, thư mục dữ liệu và partition không đổi. Chữ ký vẫn là ad-hoc, nên macOS có thể yêu cầu quyền Keychain khi mở bản mới. Không xóa hoặc tạo lại khóa `Tin Nhan Safe Storage`.

Nếu trước đây bật chạy cùng máy cho bản cũ, kiểm tra **System Settings → General → Login Items** và bỏ mục app cũ; bật lại **Mở Gom khi đăng nhập** trong Gom nếu muốn. Bộ cài không tự thay đổi mục đăng nhập macOS.

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

- DMG: `out-release/make/dmg/arm64/Gom-macOS-arm64-0.7.5.dmg`
- ZIP: `out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.7.5.zip`
- App: `out-release/Gom-darwin-arm64/Gom.app`

Cấu hình `forge.config.cjs` chỉ đưa `package.json` và các file runtime đã liệt kê trong `dist/` vào app. Mỗi khi thêm tài nguyên runtime phải cập nhật danh sách này. Source nghiên cứu, hồ sơ người dùng, kết quả kiểm thử, `node_modules` và các bản build cũ đều nằm ngoài danh sách. Kiểm tra lại nội dung `app.asar` trước khi phân phối.

Trước khi gửi, kiểm tra chữ ký ad-hoc của app bằng `codesign --verify --deep --strict`, chạy `hdiutil verify` với DMG và kiểm tra ZIP. Mount DMG ở chế độ chỉ đọc để xác nhận có `Gom.app` cùng liên kết Applications; không mở app từ DMG để kiểm thử bằng hồ sơ cá nhân.

Sao chép gói đã kiểm chứng sang tên phát hành thống nhất và tạo checksum:

```sh
mkdir -p outputs
cp out-release/make/dmg/arm64/Gom-macOS-arm64-0.7.5.dmg outputs/
cp 'out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.7.5.zip' outputs/Gom-macOS-arm64-0.7.5.zip
cd outputs
shasum -a 256 Gom-macOS-arm64-0.7.5.dmg Gom-macOS-arm64-0.7.5.zip > SHA256SUMS-Gom-0.7.5.txt
```

## Phát hành trên GitHub

Bản 0.7.5 dùng tag `v0.7.5` trong đúng repository `mhfed/gom`, kèm ghi chú [release-0.7.5.md](release-0.7.5.md) và các file:

- `Gom-macOS-arm64-0.7.5.dmg`
- `Gom-macOS-arm64-0.7.5.zip`
- `SHA256SUMS-Gom-0.7.5.txt`
Checksum của 0.7.5 chỉ bao gồm DMG và ZIP phát hành dưới tên Gom.

Tag phải khớp version trong `package.json`; tên gói cần chứa version và kiến trúc. Chỉ đăng bản ổn định sau khi có đủ gói đã kiểm chứng. Bộ kiểm tra bỏ qua draft/prerelease; bản cài mới hơn bản public sẽ thông báo rõ tình trạng đó. Các bản sau tăng version và lặp lại quy trình. Sau lần nâng cấp trực tiếp lên 0.6.2 hoặc mới hơn, chức năng kiểm tra dùng repository mới.

## Công cụ đóng gói

Sử dụng [Electron Forge DMG maker](https://www.electronforge.io/config/makers/dmg) 8.0.1, cùng phiên bản với Forge CLI. Kiểm tra dependency ngày 26/10/2026: `npm audit` báo một cảnh báo DoS của bộ đọc ICNS `image-size`, lan qua bốn package trong chuỗi `maker-dmg → electron-installer-dmg → appdmg → image-size`; chưa có bản sửa tương thích mà npm đề xuất. Chỉ dùng ảnh nền/icon cục bộ đã kiểm soát trong quá trình build. Chuỗi này là dependency phát triển, không được đưa vào `app.asar` và không chạy trên máy người nhận. Xem [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) khi cập nhật công cụ.
