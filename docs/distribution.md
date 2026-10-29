# Phân phối Gom cho macOS và Windows

[Gom 0.7.9](https://github.com/mhfed/gom/releases/tag/v0.7.9) đã phát hành ngày **29/10/2026** cho macOS Apple Silicon (arm64) và Windows x64. Cả hai bộ gói và checksum đã được kiểm chứng. [Ghi chú bản 0.7.9](release-0.7.9.md).

Bản Mac yêu cầu macOS 13 trở lên, chưa có gói Intel hoặc Universal. App ký ad-hoc, chưa ký Apple Developer ID và chưa notarize. Windows yêu cầu Windows 10/11 x64, chưa ký Authenticode.

## Cài đặt

Trên Mac, mở `Gom-macOS-arm64-0.7.9.dmg`, kéo **Gom.app** vào **Applications**, eject DMG rồi mở Gom từ Applications. Nếu macOS chặn app tải từ nguồn bạn tin cậy, vào **System Settings → Privacy & Security → Open Anyway**; xem [hướng dẫn Apple](https://support.apple.com/en-us/102445).

DMG có `Mo-Gom.command` để gỡ cờ cách ly riêng của Gom rồi mở app sau khi đã kéo vào Applications. Chỉ dùng khi tin cậy nguồn tải. Không tắt Gatekeeper toàn hệ thống. Nếu hệ thống báo app hỏng hoặc có mã độc, kiểm tra nguồn và SHA-256 trước.

Trên Windows, chạy `Gom-win32-x64-0.7.9-Setup.exe`. Squirrel cài theo tài khoản người dùng, không yêu cầu quyền quản trị viên. SmartScreen có thể cảnh báo; Smart App Control hoặc chính sách tổ chức có thể chặn app chưa ký. SHA-256 chỉ kiểm tra tính toàn vẹn, không thay chữ ký nhà phát hành.

Gói chỉ chứa chương trình và tài nguyên hiển thị. Không đưa hồ sơ Chrome, tài khoản, cookie hoặc lịch sử chat của máy build vào bộ cài.

## Nâng cấp và giữ dữ liệu

Lưu hoặc sao chép bản nháp quan trọng trước khi thoát app để nâng cấp. Trên Mac, thoát bằng **⌘Q**, thay Gom.app trong Applications rồi mở lại. Trên Windows, chọn tải bản mới trong app và khởi động lại để cài khi đã sẵn sàng.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, tên nội bộ Keychain `Tin Nhan`, thư mục `TinNhanDesktop` và các partition tài khoản. Không xóa hoặc tạo lại khóa `Tin Nhan Safe Storage`. App dùng lại dữ liệu cũ; phiên đăng nhập và khả năng khôi phục bản nháp sau thoát vẫn tùy từng dịch vụ.

Bản 0.7.9 tách Không gian thường và Không gian kín thành hai danh sách tài khoản, tab và trạng thái điều hướng riêng. Nâng cấp từ 0.7.8 giữ nguyên mật khẩu, cờ tài khoản kín và partition đăng nhập; tài khoản thường không bị chuyển sang kín. Không gian kín bắt đầu trống nếu chưa có tài khoản kín. Mật khẩu khóa giao diện, không mã hóa lại dữ liệu phiên trên đĩa. Các phiên bản cũ không hiểu cờ tài khoản kín, nên **không hạ phiên bản sau khi dùng tính năng này** nếu muốn tiếp tục giấu tài khoản trong giao diện. Xem [hướng dẫn Không gian kín](private-space.md).

Bộ kiểm tra dùng [GitHub Releases của mhfed/gom](https://github.com/mhfed/gom/releases), kiểm tra sau 30 giây khởi động bản đóng gói và mỗi 12 giờ khi chạy. Có thể tắt trong Cài đặt → Cập nhật. Draft và prerelease không được coi là bản ổn định. Các bản 0.6.0 trở về trước dùng địa chỉ repository cũ và cần nâng cấp thủ công.

### macOS

Bản ad-hoc mở trang tải xuống để cài thủ công. Để bật tự cập nhật macOS, cần ký Developer ID và notarize bằng các biến `GOM_MACOS_SIGNING_IDENTITY`, `GOM_APPLE_ID`, `GOM_APPLE_APP_SPECIFIC_PASSWORD`, `GOM_APPLE_TEAM_ID`. Không lưu thông tin ký vào Git. Giữ cùng Developer ID qua các phiên bản; lần chuyển từ ad-hoc có thể yêu cầu quyền Keychain lại.

### Windows

Squirrel tải gói tương thích trong app và chỉ cài khi người dùng chọn khởi động lại. Release phải có Setup, gói `.nupkg` đầy đủ và `RELEASES`.

Nhập phiên Chrome trên Windows hỗ trợ Zalo, Messenger, Instagram và Slack qua SQLite chỉ đọc, DPAPI và AES-GCM cookie `v10`. Chrome App-Bound `v20` chưa nhập được; người dùng đăng nhập trực tiếp. Tinder dùng cầu nối DevTools một lần, mở bằng `Ctrl+Shift+J`. Gmail, Telegram, Discord và tài khoản kín đăng nhập trực tiếp trong Gom.

## Tạo gói macOS 0.7.9

Chạy trên macOS Apple Silicon với Node.js 24+:

```sh
npm ci
npm run typecheck
npm test
npm run make
```

Electron Forge tạo:

- `out-release/Gom-darwin-arm64/Gom.app`
- `out-release/make/dmg/arm64/Gom-macOS-arm64-0.7.9.dmg`
- `out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.7.9.zip`

`forge.config.cjs` chỉ cho phép các file runtime được bundle trong `dist/` và `package.json`. Kiểm tra `app.asar` để chắc chắn source nghiên cứu, profile, kết quả kiểm thử, `node_modules` và build cũ không lọt vào gói.

Kiểm tra chữ ký với `codesign --verify --deep --strict`, DMG với `hdiutil verify` và tính toàn vẹn ZIP. Mount DMG chỉ đọc để kiểm tra Gom.app, liên kết Applications và script mở app. Kiểm thử bằng profile tạm, không dùng tài khoản cá nhân.

Sao chép gói đã kiểm chứng và tạo checksum:

```sh
mkdir -p outputs
cp out-release/make/dmg/arm64/Gom-macOS-arm64-0.7.9.dmg outputs/Gom-macOS-arm64-0.7.9.dmg
cp out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.7.9.zip outputs/Gom-macOS-arm64-0.7.9.zip
cd outputs
shasum -a 256 Gom-macOS-arm64-0.7.9.dmg Gom-macOS-arm64-0.7.9.zip > SHA256SUMS-Gom-0.7.9-macos.txt
```

## Windows và GitHub Release

Tag `v0.7.9` phải trỏ tới source có version `0.7.9` trong `package.json`. Tạo draft trong đúng repository `mhfed/gom`, dùng [release-0.7.9.md](release-0.7.9.md) làm ghi chú và tải ba asset Mac lên.

Sau khi có draft, chạy workflow **Windows release assets** (`.github/workflows/windows-release.yml`) bằng `workflow_dispatch` với tag `v0.7.9`. Workflow kiểm tra version, cài dependency, typecheck và tạo Squirrel trên runner Windows; tải các file sau lên draft:

- `Gom-win32-x64-0.7.9-Setup.exe`
- `Gom_win32_x64-0.7.9-full.nupkg`
- `RELEASES`
- `SHA256SUMS-Gom-0.7.9-windows.txt`

Workflow không tự chạy theo push/tag và không tự xuất bản draft. Kiểm tra đủ bảy asset Mac/Windows và đối chiếu checksum trước khi công bố [GitHub Release 0.7.9](https://github.com/mhfed/gom/releases/tag/v0.7.9).

## Công cụ đóng gói

Dùng Electron Forge và DMG maker 8.0.1. Lần kiểm tra dependency ngày 26/10/2026 ghi nhận cảnh báo DoS ở bộ đọc ICNS `image-size` trong chuỗi dependency build; xem [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) khi cập nhật. Chỉ dùng icon/ảnh nền cục bộ đã kiểm soát. Chuỗi đóng gói này không được đưa vào runtime của app.
