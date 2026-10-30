# Phân phối Gom cho macOS và Windows

[Gom 0.8.3](https://github.com/mhfed/gom/releases/tag/v0.8.3) đã phát hành ngày **30/10/2026** cho macOS Apple Silicon (arm64) và Windows x64. Bộ gói, checksum và kiểm thử trên cả hai nền tảng đã đạt; bản Mac đã được cài trên máy theo yêu cầu. Xem [ghi chú 0.8.3](release-0.8.3.md) và [biên bản kiểm chứng](verification-0.8.3.md).

Bản Mac yêu cầu macOS 13 trở lên, chưa có gói Intel hoặc Universal. App ký ad-hoc, chưa ký Apple Developer ID và chưa notarize. Windows yêu cầu Windows 10/11 x64, chưa ký Authenticode.

## Cài đặt

Trên Mac, mở `Gom-macOS-arm64-0.8.3.dmg`, kéo **Gom.app** vào **Applications**, eject DMG rồi mở Gom từ Applications. Nếu macOS chặn app tải từ nguồn bạn tin cậy, vào **System Settings → Privacy & Security → Open Anyway**; xem [hướng dẫn Apple](https://support.apple.com/en-us/102445).

DMG có `Mo-Gom.command` để gỡ cờ cách ly riêng của Gom rồi mở app sau khi đã kéo vào Applications. Chỉ dùng khi tin cậy nguồn tải. Không tắt Gatekeeper toàn hệ thống. Nếu hệ thống báo app hỏng hoặc có mã độc, kiểm tra nguồn và SHA-256 trước.

Trên Windows, chạy `Gom-win32-x64-0.8.3-Setup.exe`. Squirrel cài theo tài khoản người dùng, không yêu cầu quyền quản trị viên. SmartScreen có thể cảnh báo; Smart App Control hoặc chính sách tổ chức có thể chặn app chưa ký. SHA-256 chỉ kiểm tra tính toàn vẹn, không thay chữ ký nhà phát hành.

Gói chỉ chứa chương trình và tài nguyên hiển thị. Không đưa hồ sơ Chrome, tài khoản, cookie hoặc lịch sử chat của máy build vào bộ cài.

## Nâng cấp và giữ dữ liệu

Lưu hoặc sao chép bản nháp quan trọng trước khi thoát app để nâng cấp. Trên Mac, thoát bằng **⌘Q**, thay Gom.app trong Applications rồi mở lại. Trên Windows, chọn tải bản mới trong app và khởi động lại để cài khi đã sẵn sàng.

Giữ nguyên bundle ID `local.mhfed.tinnhan.desktop`, tên nội bộ Keychain `Tin Nhan`, thư mục `TinNhanDesktop` và các partition tài khoản. Không xóa hoặc tạo lại khóa `Tin Nhan Safe Storage`. App dùng lại dữ liệu cũ; phiên đăng nhập và khả năng khôi phục bản nháp sau thoát vẫn tùy từng dịch vụ.

Từ bản 0.7.9, Gom tách Không gian thường và Không gian kín thành hai danh sách tài khoản, tab và trạng thái điều hướng riêng. Nâng cấp từ 0.7.8 giữ nguyên mật khẩu, cờ tài khoản kín và partition đăng nhập; tài khoản thường không bị chuyển sang kín. Không gian kín bắt đầu trống nếu chưa có tài khoản kín. Mật khẩu khóa giao diện, không mã hóa lại dữ liệu phiên trên đĩa. Các phiên bản cũ không hiểu cờ tài khoản kín, nên **không hạ phiên bản sau khi dùng tính năng này** nếu muốn tiếp tục giấu tài khoản trong giao diện. Xem [hướng dẫn Không gian kín](private-space.md).

Chat nổi giữ phiên đăng nhập khi chuyển tab giữa cửa sổ chính và cửa sổ nổi. Từ 0.8.1, mỗi lần tách mới tải lại trang một lần để khởi tạo bố cục theo khung nhỏ; bản nháp chưa lưu có thể mất tùy nền tảng. Thu/mở bong bóng và đưa tab về Gom không tải lại trang. Mỗi lúc chỉ có một tab nổi; khóa Không gian kín hoặc chuyển không gian thu hồi cửa sổ nổi và bong bóng. Xem [hướng dẫn Chat nổi](floating-chat.md).

Từ 0.8.1, Khay giữ bản sao chữ, link, ảnh và tệp trên máy, tách theo không gian và mã hóa bằng khóa do tài khoản hệ điều hành bảo vệ. Bản 0.8.3 thêm Nhắc trả lời với ghi chú và giờ hẹn do người dùng chọn; việc thường có thông báo khi Gom đang chạy, việc kín chỉ hiện trong danh sách kín. Các kho này được dùng lại khi mở lại app. Xem [hướng dẫn Khay](transfer-shelf.md) và [Nhắc trả lời](reply-reminders.md).

Bộ kiểm tra dùng [GitHub Releases của mhfed/gom](https://github.com/mhfed/gom/releases), kiểm tra sau 30 giây khởi động bản đóng gói và mỗi 12 giờ khi chạy. Có thể tắt trong Cài đặt → Cập nhật. Draft và prerelease không được coi là bản ổn định. Các bản 0.6.0 trở về trước dùng địa chỉ repository cũ và cần nâng cấp thủ công.

### macOS

Bản ad-hoc mở trang tải xuống để cài thủ công. Để bật tự cập nhật macOS, cần ký Developer ID và notarize bằng các biến `GOM_MACOS_SIGNING_IDENTITY`, `GOM_APPLE_ID`, `GOM_APPLE_APP_SPECIFIC_PASSWORD`, `GOM_APPLE_TEAM_ID`. Không lưu thông tin ký vào Git. Giữ cùng Developer ID qua các phiên bản; lần chuyển từ ad-hoc có thể yêu cầu quyền Keychain lại.

### Windows

Squirrel tải gói tương thích trong app và chỉ cài khi người dùng chọn khởi động lại. Release phải có Setup, gói `.nupkg` đầy đủ và `RELEASES`.

Nhập phiên Chrome trên Windows hỗ trợ Zalo, Messenger, Instagram và Slack qua SQLite chỉ đọc, DPAPI và AES-GCM cookie `v10`. Chrome App-Bound `v20` chưa nhập được; người dùng đăng nhập trực tiếp. Tinder dùng cầu nối DevTools một lần, mở bằng `Ctrl+Shift+J`. Gmail, Telegram, Discord và tài khoản kín đăng nhập trực tiếp trong Gom.

## Tạo gói macOS 0.8.3

Chạy trên macOS Apple Silicon với Node.js 24+:

```sh
npm ci
npm run typecheck
npm test
npm run make
```

Electron Forge tạo:

- `out-release/Gom-darwin-arm64/Gom.app`
- `out-release/make/dmg/arm64/Gom-macOS-arm64-0.8.3.dmg`
- `out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.8.3.zip`

`forge.config.cjs` chỉ cho phép các file runtime được bundle trong `dist/` và `package.json`. Kiểm tra `app.asar` để chắc chắn source nghiên cứu, profile, kết quả kiểm thử, `node_modules` và build cũ không lọt vào gói.

Kiểm tra chữ ký với `codesign --verify --deep --strict`, DMG với `hdiutil verify` và tính toàn vẹn ZIP. Mount DMG chỉ đọc để kiểm tra Gom.app, liên kết Applications và script mở app. Kiểm thử bằng profile tạm, không dùng tài khoản cá nhân.

Sao chép gói đã kiểm chứng và tạo checksum:

```sh
mkdir -p outputs/releases/0.8.3
cp out-release/make/dmg/arm64/Gom-macOS-arm64-0.8.3.dmg outputs/releases/0.8.3/Gom-macOS-arm64-0.8.3.dmg
cp out-release/make/zip/darwin/arm64/Gom-darwin-arm64-0.8.3.zip outputs/releases/0.8.3/Gom-macOS-arm64-0.8.3.zip
cd outputs/releases/0.8.3
shasum -a 256 Gom-macOS-arm64-0.8.3.dmg Gom-macOS-arm64-0.8.3.zip > SHA256SUMS-Gom-0.8.3-macos.txt
```

## Windows và GitHub Release

Tag `v0.8.3` phải trỏ tới source có version `0.8.3` trong `package.json`. Tạo draft trong đúng repository `mhfed/gom`, dùng [release-0.8.3.md](release-0.8.3.md) làm ghi chú và tải ba asset Mac lên. Cập nhật biên bản bằng kết quả thực tế; không công bố các trạng thái còn chờ.

Sau khi có draft, chạy workflow **Windows release assets** (`.github/workflows/windows-release.yml`) bằng `workflow_dispatch` với tag `v0.8.3`. Workflow kiểm tra version, cài dependency, typecheck, chạy hồi quy và tạo Squirrel trên runner Windows; kiểm tra ASAR, payload Squirrel cùng các nhóm Nhắc trả lời, Không gian kín, chat nổi và Khay trên gói trước khi tải các file sau lên draft:

- `Gom-win32-x64-0.8.3-Setup.exe`
- `Gom_win32_x64-0.8.3-full.nupkg`
- `RELEASES`
- `SHA256SUMS-Gom-0.8.3-windows.txt`

Workflow không tự chạy theo push/tag và không tự xuất bản draft. Kiểm tra đủ bảy asset Mac/Windows và đối chiếu checksum trước khi công bố [GitHub Release 0.8.3](https://github.com/mhfed/gom/releases/tag/v0.8.3). Sau khi cài lên máy, đối chiếu version và ASAR của bản cài với gói đã kiểm chứng rồi ghi kết quả vào biên bản.

## Công cụ đóng gói

Dùng Electron Forge và DMG maker 8.0.1. Lần kiểm tra dependency ngày 26/10/2026 ghi nhận cảnh báo DoS ở bộ đọc ICNS `image-size` trong chuỗi dependency build; xem [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) khi cập nhật. Chỉ dùng icon/ảnh nền cục bộ đã kiểm soát. Chuỗi đóng gói này không được đưa vào runtime của app.
