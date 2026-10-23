# Tin nhắn — macOS

Ứng dụng cá nhân bọc giao diện web chính thức của Zalo, Messenger và Telegram. Sidebar chuyển giữa ba khung độc lập; mỗi khung dùng một partition cố định và không bị tạo lại khi đổi nền tảng.

## Tải app

[Tải Tin Nhan 0.2.0 cho macOS Apple Silicon (arm64)](https://github.com/mhfed/tin-nhan-desktop/releases/download/v0.2.0/TinNhan-macOS-arm64-0.2.0.zip)

Giải nén ZIP, kéo `Tin Nhan.app` vào Applications rồi mở app. Bản cá nhân ký ad-hoc, chưa có Developer ID / notarization. Repository public, có thể tải trực tiếp.

Chi tiết và SHA-256 nằm trong [Release 0.2.0](https://github.com/mhfed/tin-nhan-desktop/releases/tag/v0.2.0).

## Chạy và đóng gói

Yêu cầu macOS Apple Silicon, Node.js 24+ và npm. Electron được tải từ bản phát hành chính thức.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
npm run make
```

Bản app nằm trong `out-release/Tin Nhan-darwin-arm64/`; ZIP trong `out-release/make/`. Bản cá nhân dùng chữ ký ad-hoc, chưa có Developer ID / notarization để phân phối công khai.

## Tài khoản

- Messenger: mở Tài khoản & cài đặt, chọn hồ sơ Chrome, bấm Dùng phiên có sẵn. Anh chọn hồ sơ trong danh sách; app không ghi cứng email cá nhân. Chỉ hai cookie Facebook cần thiết được đọc bằng SQLite ở chế độ chỉ đọc và giải mã qua Chrome Safe Storage trong Keychain.
- Phiên được thử trong cửa sổ tạm trước; chỉ chấp nhận sau khi Messenger đích đã xác minh đăng nhập. Thất bại sẽ khôi phục cặp cookie cũ. Đóng app trong lúc nhập sẽ đợi giao dịch kết thúc.
- Zalo và Telegram: đăng nhập QR trực tiếp trên giao diện chính thức. Nếu nền tảng thu hồi hoặc hết hạn phiên, phải đăng nhập lại.
- Dữ liệu của app lưu tại `~/Library/Application Support/TinNhanDesktop`. Không sao chép toàn bộ Chrome profile; không xuất token ra log hoặc renderer.
- Cmd+W hoặc nút đóng cửa sổ chỉ ẩn cửa sổ; app vẫn chạy và giữ các trang đang mở. Bấm icon Dock để mở lại. Cmd+Q mới thoát app sau khi ghi dữ liệu. Chuyển sidebar giữ nguyên view và bản nháp đang mở; khôi phục bản nháp sau thoát phụ thuộc chính nền tảng.

## Kiểm thử

```sh
npm test
npm run test:persistence
npm run test:live
```

`test:persistence` dùng dữ liệu giả ở `../persistence-fixture`, chạy hai tiến trình Electron để kiểm tra cookie bền vững, localStorage, IndexedDB, cách ly ba partition và tái sử dụng view.

`test:live` là harness phát triển riêng, không được đóng gói vào app. Nó mở bản app đã đóng gói trên phiên cá nhân thật; chỉ chạy trong phạm vi người dùng đã đồng ý. Lệnh stdin: `status`, `activate zalo`, `activate messenger`, `activate telegram`, `settings`, `import Default`, `resize 1024x720`, `screenshot`, `quit`, `launch`. `import` chỉ dùng khi chủ tài khoản yêu cầu. Không gửi tin nhắn trong các kiểm thử.

Remote views có sandbox, context isolation và tắt Node. Preload riêng của nền tảng chỉ thêm sự kiện bấm vào thông báo gốc; không nhận nội dung thông báo và không cấp API đọc file/tài khoản. IPC điều khiển app chỉ nhận từ main frame của shell cục bộ; kênh bấm thông báo chỉ nhận từ main frame của view/popup đã đăng ký đúng nền tảng và chỉ mở lại nền tảng đó; popup nội bộ giữ đúng session; link HTTP(S) bên ngoài yêu cầu xác nhận trước khi mở trình duyệt.

## Sidebar và số chưa đọc 0.2.0

Nút bên trái tiêu đề thu gọn/mở rộng sidebar; lựa chọn được lưu khi thoát. Logo gốc được đóng gói cục bộ, xem src/renderer/logos/SOURCES.md. Ba nền tảng được mở nền để cập nhật chỉ báo mỗi4giây.

Badge theo số nền tảng cung cấp: Telegram đọc mục Unread/Chưa đọc; Zalo đọc chỉ báo trên thanh điều hướng tin nhắn; Messenger ưu tiên số trên tiêu đề/tab và chỉ báo hội thoại chưa đọc. Số có + là cận dưới trong phần danh sách đã tải hoặc số đã được nền tảng rút gọn. Ký hiệu — nghĩa là chưa có số đáng tin cậy; số0 được ẩn. Hiện phiên Messenger khảo sát không cung cấp tổng số qua các chỉ báo hỗ trợ, nên hiển thị —. Bộ thu chỉ trả về số, không chuyển nội dung tin nhắn về shell.

## Đồng bộ màu nền tảng 0.2.2

Sidebar và thanh trên tự lấy màu nền trung tính từ giao diện của nền tảng đang chọn. Chữ, đường viền, nút và trang cài đặt theo cùng tông sáng/tối; logo giữ màu gốc. Màu được kiểm tra khi tải trang, chuyển nền tảng và mỗi 4 giây. Khi chưa nhận diện được màu, shell theo chế độ sáng/tối của macOS. Bộ nhận diện chỉ đọc màu CSS, không lấy nội dung tin nhắn. Một số giao diện tùy biến hoặc thay đổi cấu trúc nền tảng có thể cần điều chỉnh bộ nhận diện.

## Bản 0.3.0 — ổn định, macOS và thông báo

- Mất mạng được phân biệt với yêu cầu đăng nhập lại. Chỉ trang tải lỗi/crash được thử lại tối đa3 lần với khoảng chờ tối thiểu1/3/10 giây (kiểm tra theo nhịp4 giây); không tự reload các trang đang hoạt động khi wake/có mạng lại. Liên kết bị chặn không được tự retry. Lỗi vẫn còn sẽ có nút thử lại riêng nền tảng. Trang tải lại có thể mất bản nháp trong chính trang đó; app không xóa phiên.
- Menu bar: mở app, chọn nền tảng, tạm dừng thông báo và thoát. Cmd+W ẩn, Cmd+Q ghi phiên rồi thoát; Cmd+1/2/3 chuyển nền tảng, Cmd+[ quay lại, Cmd+R tải lại nền tảng đang chọn. Nút Trang đầu chỉ tác động nền tảng hiện tại.
- Cài đặt có phím tắt hiện/ẩn Cmd+Shift+Space (mặc định tắt, báo khi bị app khác chiếm), chạy cùng macOS (chỉ bản đóng gói, mặc định không tự bật). Cửa sổ nhớ vị trí/kích thước và nằm trong màn hình còn kết nối khi mở lại.
- Quyền thông báo riêng: Hỏi lần đầu / Cho phép / Tắt; có tạm dừng chung, nút thử và liên kết quyền macOS. Thông báo gốc vẫn do nền tảng tạo, không suy diễn tin mới từ số unread. Chọn Cho phép trong app và bật thông báo trong chính nền tảng nếu nó không chủ động hỏi quyền. macOS/Focus quyết định hiển thị; nút thử không chứng minh nền tảng đã phát thông báo tin nhắn thật.
- Bấm thông báo được tạo bằng `window.Notification` mở đúng nền tảng khi app còn chạy. Thông báo service worker và thông báo cũ sau khi thoát hẳn app giữ cách xử lý của nền tảng, chưa có cam kết định tuyến. Nội dung thông báo ở luồng gốc của nền tảng/macOS, không chuyển vào shell hoặc log. Tắt thông báo không tắt âm thanh/cuộc gọi của trang web; thông báo đã hiển thị trước đó không bị xóa.
- Badge Dock chỉ là dấu chấm khi có số unread dương được hỗ trợ; không cộng số tin nhắn và số hội thoại thành tổng sai. Unknown không được coi là0.

Kiểm tra hồi quy bổ sung (Electron mở fixture cách ly; không gửi tin nhắn thật):

```sh
npm run test:desktop
node scripts/window-lifecycle-check.mjs
node scripts/theme-check.mjs
```

`test:desktop` kiểm tra quyền thực trong renderer, khung lạ bị từ chối, phím tắt/xung đột (mock OS), thông báo/click (mock delivery), mất mạng/wake giữ bản nháp trang khác, crash renderer thật trong fixture, retry và lưu lựa chọn sau mở lại. Kiểm tra thông báo thật cần bản app ký trên macOS, cấp quyền rồi thử nhận tin từ thiết bị khác. Không tự thay đổi mục đăng nhập macOS trong các fixture.

## Multi-account 0.4.0

Sidebar nhóm tài khoản theo Zalo, Messenger và Telegram. Bấm dấu + ở nhóm hoặc **Thêm tài khoản** để tạo phiên riêng; đặt tên và chữ/emoji để phân biệt. Trong Cài đặt có Mở, Đổi tên, sắp xếp ↑/↓, Gỡ khỏi sidebar và Khôi phục. Avatar là ký hiệu cục bộ, không tự lấy ảnh hồ sơ từ nội dung chat.

Ba tài khoản có sẵn được giữ nguyên ID và partition `persist:zalo`, `persist:messenger`, `persist:telegram` tại userData cũ. Không sao chép hoặc xóa cookie để nâng cấp. Tài khoản mới dùng ID UUID cố định và partition mới riêng; đổi tên/sắp xếp không đổi partition. App tự giữ một bản sao **cài đặt cửa sổ** trước nâng cấp (`window.json.pre-0.4`), không tạo bản xuất dữ liệu đăng nhập.

Danh sách nằm trong `accounts.json` (chỉ ID/nền tảng/tên/ký hiệu/trạng thái ẩn), ghi nguyên tử và có bản metadata trước đó ở `accounts.json.backup`. Nếu danh sách lỗi, app dùng danh sách nhận diện được ở chế độ bảo vệ và khóa các thay đổi metadata để tránh ghi đè; dữ liệu phiên không bị xóa. Không chỉnh ID/nền tảng bằng tay vì đây là khóa liên kết tới phiên cũ.

**Gỡ khỏi sidebar không đăng xuất:** trang của tài khoản sẽ đóng, dữ liệu đăng nhập/localStorage/IndexedDB vẫn giữ trên máy và có thể Khôi phục với cùng ID. Việc giữ bản nháp qua đóng trang tùy nền tảng. Không cho gỡ tài khoản đang dùng cuối cùng. Các tài khoản còn lại giữ nguyên trang/bản nháp đang mở.

Mỗi tài khoản có unread, màu giao diện, quyền thông báo và phục hồi lỗi riêng. Bấm thông báo mở đúng tài khoản phát ra, không nhảy về tài khoản mặc định cùng nền tảng. Các giới hạn thông báo gốc/service worker ở0.3 vẫn áp dụng. Cmd+1/2/3 trở về tài khoản vừa chọn gần nhất của nền tảng tương ứng; menu bar liệt kê tên từng tài khoản.

Zalo/Telegram thêm bằng QR trong phiên mới. Messenger có thể đăng nhập trực tiếp hoặc chọn rõ **Tài khoản Messenger đích** và hồ sơ Chrome nguồn trong Cài đặt. Tài khoản đích được giữ cố định suốt giao dịch nhập; app kiểm tra trực tiếp trước và sau bước xác minh nguồn; nếu đích đang tải hoặc đã có cookie đăng nhập thì từ chối nhập để giữ phiên cũ, kể cả khi trạng thái giao diện chưa kịp cập nhật. App không thay phiên của tài khoản đã xác thực và không cho gỡ/sửa danh sách khi đang nhập. Phiên còn hiệu lực phụ thuộc chính sách/expiry của nền tảng.

Mọi tài khoản chưa gỡ được mở nền khi khởi động để duy trì thông báo và unread; số tài khoản tăng sẽ dùng thêm RAM. Chưa có chế độ ngủ tài khoản trong0.4.

```sh
npm run test:multi-account
```

Fixture cách ly seeding dữ liệu kiểu0.3 rồi chạy0.4, kiểm tra6 tài khoản/2 mỗi nền tảng, cookie/localStorage/IndexedDB riêng, giữ dữ liệu cũ, nhập Messenger đúng đích khi chuyển tài khoản trong lúc chờ, unread/quyền thông báo/click riêng, gỡ/khôi phục, nhãn an toàn và thoát/mở lại. Chrome/Keychain/thông báo trong fixture dùng dữ liệu giả; không gửi tin nhắn thật. Đăng nhập đồng thời hai tài khoản thật của từng nền tảng cần kiểm tra thêm bằng tài khoản phụ của chủ máy.

## Sidebar 0.4.1

Sidebar mở rộng224px, thu gọn72px; hàng tài khoản44px. Giảm khoảng trống phía trên, giữ các nút Thêm tài khoản/Cài đặt cố định bên dưới; chỉ danh sách tài khoản cuộn khi thiếu chiều cao. Tên dài được rút gọn trong hàng, badge không co avatar. Kích thước nội dung nền tảng dùng cùng mốc với sidebar.

Kiểm tra bố cục cách ly: `node scripts/sidebar-layout-check.mjs` sau `npm run build` (940×640,1024×720,1280×840; sáu tài khoản, cả hai chế độ).
