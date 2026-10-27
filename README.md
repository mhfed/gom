> **Gom 0.7.3 — Dùng phiên Chrome:** nhập phiên cookie có giới hạn cho Messenger, Instagram, Slack và Zalo; Gmail, Discord, Telegram đăng nhập trực tiếp trong Gom. Có thể chọn tài khoản đích và profile nguồn rõ ràng. Bản cài này vẫn cập nhật bằng cách tải DMG/ZIP và thay app thủ công; tự cài cần Developer ID và notarization.
>
> Kiểm tra giao diện hiện hành: `npm run test:providers`, `npm run test:shell` và `npm run test:settings` (fixture cách ly, không dùng phiên cá nhân). Connector chat thống nhất đã dừng theo yêu cầu; mã nghiên cứu không được đóng gói. Các mô tả sidebar/prototype bên dưới là lịch sử phiên bản trước.

# Gom — macOS

**Trò chuyện, gọn một nơi.** Gom là ứng dụng cá nhân bọc giao diện web chính thức của Zalo, Messenger, Telegram, Gmail, Instagram, Discord và Slack. Hỗ trợ nhiều tài khoản cho mỗi nền tảng, mỗi tài khoản giữ phiên riêng và trang đang mở khi chuyển qua lại.

## Tải app

Bản mới nhất: **Gom 0.7.3**, phát hành ngày 27/10/2026 cho Mac Apple Silicon (arm64).

- [Tải DMG](https://github.com/mhfed/gom/releases/download/v0.7.3/Gom-macOS-arm64-0.7.3.dmg)
- [Tải ZIP](https://github.com/mhfed/gom/releases/download/v0.7.3/Gom-macOS-arm64-0.7.3.zip)
- [Release và checksum](https://github.com/mhfed/gom/releases/tag/v0.7.3)

Tab đang mở có thể ghim, đóng và tự gom vào menu khi thiếu chỗ. Nút **+** mở thư viện để tìm nền tảng hoặc thêm website riêng. Nhớ tab mở, tab ghim và tài khoản cuối khi khởi động lại. Header giữ 52px; Cài đặt hỗ trợ danh sách nền tảng động và giao diện sáng/tối. Giữ dữ liệu tài khoản và định danh khóa mã hóa hiện có. Có kiểm tra cập nhật trong Cài đặt và menu Gom. [Hướng dẫn cài và phát hành](docs/distribution.md) · [Ghi chú 0.7.3](docs/release-0.7.3.md).

Lưu bản nháp quan trọng, thoát app đang dùng bằng ⌘Q, mở DMG và kéo `Gom.app` vào Applications. Khi nâng cấp lần đầu, macOS có thể giữ app cũ riêng vì tên đã đổi; sau khi kiểm tra Gom, có thể gỡ app cũ khỏi Applications. Giữ nguyên thư mục dữ liệu `TinNhanDesktop`. Bản ký ad-hoc, chưa có Developer ID / notarization; lần đầu mở có thể bị macOS chặn. Nếu đã tin cậy nguồn tải, có thể bấm đúp `Mo-Gom.command` trong DMG hoặc dùng Open Anyway theo [hướng dẫn cài](docs/distribution.md).

Repository đã chuyển sang `mhfed/gom`. Các bản 0.6.0 trở về trước cần tải DMG trực tiếp để nâng cấp lần này vì bộ kiểm tra cập nhật vẫn trỏ tới địa chỉ cũ. Bản 0.6.2 đã sửa nguồn cập nhật.

Catalog tài khoản được nâng lên v2 khi lưu thay đổi. Bản 0.6.x không đọc được catalog mới; sau khi dùng 0.7.3 nên tiếp tục dùng 0.7.x hoặc mới hơn và giữ nguyên thư mục dữ liệu.

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

Bản app nằm trong `out-release/Gom-darwin-arm64/`; DMG và ZIP trong `out-release/make/`. Bản này dùng chữ ký ad-hoc, chưa có Developer ID / notarization; người nhận có thể cần cho phép mở trong Cài đặt hệ thống. Xem [hướng dẫn phân phối](docs/distribution.md).

## Tài khoản

- **Website riêng:** dùng URL đầy đủ `https://…` hoặc `http://…`; hỗ trợ địa chỉ nội bộ và cổng riêng. Website mới có tài khoản Cá nhân với phiên đăng nhập riêng, biểu tượng từ chữ đầu tên; có thể thêm tài khoản khác trong Cài đặt. Tên và địa chỉ được lưu cục bộ cùng danh sách tài khoản. Trạng thái tab mở/ghim được lưu riêng, không thay đổi ghim tài khoản cũ.
- **Đóng tab:** không gỡ nền tảng hoặc xóa dữ liệu đăng nhập. Tab cuối đóng sẽ mở thư viện. Website riêng chỉ tải khi được chọn, đóng tab sẽ lưu phiên và giải phóng trang; dữ liệu chưa gửi trên trang phụ thuộc website. Ba nền tảng nhắn tin có sẵn vẫn giữ hoạt động nền theo cơ chế cũ.
- Website riêng chỉ điều hướng trong cùng origin đã cấu hình; liên kết ra ngoài mở trình duyệt sau xác nhận. Luồng đăng nhập SSO chuyển sang origin khác có thể cần đăng nhập trực tiếp trên website hoặc được hỗ trợ thêm. Gom không suy diễn số tin chưa đọc cho website riêng.

- **Dùng phiên Chrome:** trong Tài khoản & cài đặt, chọn tài khoản đích và hồ sơ Chrome. Cookie xác thực được cho phép của Messenger, Instagram, Slack và Zalo được đọc bằng SQLite chỉ đọc, giải mã qua Chrome Safe Storage trong Keychain, rồi thử trong cửa sổ tạm. Chỉ chuyển cookie sau khi trang dịch vụ xác minh đăng nhập; không chép cả profile hoặc cookie của dịch vụ khác. Nếu kiểm tra thất bại, cookie xác thực đích được khôi phục.
- Gmail, Discord và Telegram chưa hỗ trợ nhập phiên Chrome; đăng nhập trực tiếp trong Gom (Zalo/Telegram có thể dùng QR). Nếu nền tảng thu hồi hoặc hết hạn phiên, phải đăng nhập lại.
- Dữ liệu của app lưu tại `~/Library/Application Support/TinNhanDesktop`. Không sao chép toàn bộ Chrome profile; không xuất token ra log hoặc renderer.
- Cmd+W hoặc nút đóng cửa sổ chỉ ẩn cửa sổ; app vẫn chạy và giữ các trang đang mở. Bấm icon Dock để mở lại. Cmd+Q mới thoát app sau khi ghi dữ liệu. Chuyển tab hoặc tài khoản giữ nguyên view và bản nháp đang mở; khôi phục bản nháp sau thoát phụ thuộc chính nền tảng.

## Kiểm thử

```sh
npm test
npm run test:persistence
npm run test:desktop
npm run test:multi-account
npm run test:shell
npm run test:settings
npm run test:providers
npm run test:updates
```

`test:persistence` tạo thư mục tạm riêng cho mỗi lần chạy và dọn sau khi kết thúc, chạy hai tiến trình Electron để kiểm tra cookie bền vững, localStorage, IndexedDB, cách ly ba partition và tái sử dụng view. Ảnh kiểm thử giao diện được lưu trong `outputs/<tên-kiểm-thử>/` của repository; thư mục này không được theo dõi bởi Git hoặc đóng gói vào app.

Đo hiệu năng bằng Electron native, với hồ sơ tạm và trang giả cố định:

```sh
npm run build
npm run test:performance -- --label after
# So sánh hai bản đã đo bằng cùng cấu hình:
npm run test:performance -- --compare outputs/performance-comparison/before.json outputs/performance-comparison/after.json
```

Mặc định đo hai lượt cho 3/6/12 tài khoản và ba trang chờ đăng nhập; mỗi ca chờ 32 giây rồi đo 20,4 giây khi ẩn cửa sổ. `--dist <thư-mục-build>` chọn bản trước/sau; `--only-activity` đo riêng fixture đăng nhập có hoạt ảnh. Bộ đo kiểm tra bản nháp, trạng thái trang và dữ liệu phiên giữ nguyên qua chuyển tài khoản/ẩn/hiện. Tổng working set có thể đếm trùng bộ nhớ dùng chung; fixture không đại diện CPU, RAM hay pin của nền tảng thật. Xem `--help` để điều chỉnh thời lượng.

`npm run test:renderer-performance` kiểm tra DOM thật bằng Chromium riêng; cần browser của Playwright hoặc đặt `TIN_NHAN_CHROMIUM` tới executable Chromium/Chrome đã cài. Test này không mở profile cá nhân.

Các nền tảng nhắn tin có sẵn giữ trang tài khoản để bảo toàn bản nháp và hoạt động nền; website riêng chỉ tạo trang khi được chọn và đóng trang sau khi ghi dữ liệu phiên khi người dùng đóng tab. App bỏ phát trạng thái trùng, gộp kiểm tra trang, lấy màu cho tài khoản đang chọn khi cần và kết thúc giai đoạn miễn throttling sau tối đa 30 giây (sớm hơn nếu nhận diện đăng nhập). Không xóa hoặc chuyển partition khi đóng/mở tab. Bản cài mới nhất là **Gom 0.7.3**, bổ sung nhập phiên Chrome có giới hạn: `outputs/Gom-macOS-arm64-0.7.3.dmg`, kèm `outputs/SHA256SUMS-Gom-0.7.3.txt`; các file tương ứng có tại link phát hành ở đầu tài liệu. Sao chép bản nháp quan trọng trước khi thoát app để nâng cấp vì phục hồi bản nháp sau thoát phụ thuộc nền tảng.

Chi tiết thay đổi, phương pháp và kết quả đối chiếu: [báo cáo hiệu năng 26/10/2026](docs/performance-2026-10-26.md).

Sửa lỗi EVKey dùng chế độ tương thích focus chỉ cho macOS với Electron 45.0.0 / Chromium 156.0.8078.48; vẫn bảo vệ ô mật khẩu đang dùng. `npm run build && npm run test:ime` kiểm tra Secure Input bằng Electron native và hồ sơ tạm, gồm chuyển cửa sổ, ẩn/thu nhỏ, iframe và popup. Chạy riêng, không đồng thời với các kiểm thử GUI khác; cần macOS, Python 3 và không có ứng dụng khác đang giữ Secure Input. Luôn chạy lại khi cập nhật Electron. Chi tiết: [điều tra EVKey](docs/evkey-2026-10-26.md).

Theo yêu cầu xem thiết kế trước, giao diện chat thống nhất nằm riêng tại `outputs/unified-chat-design/index.html`, dùng dữ liệu mẫu và không gửi tin thật. [Đề xuất thiết kế](docs/superpowers/specs/2026-10-26-unified-chat-design.md) nêu giới hạn tích hợp cho tài khoản cá nhân. Giao diện này chưa được đưa vào bản cài đặt.

`npm run test:live` là harness phát triển riêng, không nằm trong các kiểm tra cách ly ở trên và không được đóng gói vào app. Nó mở bản app đã đóng gói trên phiên cá nhân thật; chỉ chạy trong phạm vi người dùng đã đồng ý. Lệnh stdin: `status`, `activate zalo`, `activate messenger`, `activate telegram`, `settings`, `import Default`, `resize 1024x720`, `screenshot`, `quit`, `launch`. `import` chỉ dùng khi chủ tài khoản yêu cầu. Không gửi tin nhắn trong các kiểm thử.

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

Zalo/Telegram thêm bằng QR trong phiên mới. Dùng phiên Chrome cho Messenger, Instagram, Slack hoặc Zalo bằng cách chọn rõ tài khoản đích và profile nguồn trong Cài đặt. Tài khoản đích được giữ cố định suốt giao dịch; app kiểm tra trạng thái đăng nhập cả trước lẫn sau xác minh nguồn. Cookie xác thực đang có hoặc trùng cookie nguồn sẽ không bị ghi đè; lỗi xác minh sẽ khôi phục cookie được phép. App không cho gỡ/sửa tài khoản khi đang nhập. Phiên còn hiệu lực phụ thuộc chính sách/expiry của nền tảng.

Mọi tài khoản chưa gỡ được mở nền khi khởi động để duy trì thông báo và unread; số tài khoản tăng sẽ dùng thêm RAM. Chưa có chế độ ngủ tài khoản trong0.4.

```sh
npm run test:multi-account
```

Fixture cách ly seeding dữ liệu kiểu0.3 rồi chạy0.4, kiểm tra6 tài khoản/2 mỗi nền tảng, cookie/localStorage/IndexedDB riêng, giữ dữ liệu cũ, nhập Messenger đúng đích khi chuyển tài khoản trong lúc chờ, unread/quyền thông báo/click riêng, gỡ/khôi phục, nhãn an toàn và thoát/mở lại. Chrome/Keychain/thông báo trong fixture dùng dữ liệu giả; không gửi tin nhắn thật. Đăng nhập đồng thời hai tài khoản thật của từng nền tảng cần kiểm tra thêm bằng tài khoản phụ của chủ máy.

## Sidebar 0.4.1

Sidebar mở rộng224px, thu gọn72px; hàng tài khoản44px. Giảm khoảng trống phía trên, giữ các nút Thêm tài khoản/Cài đặt cố định bên dưới; chỉ danh sách tài khoản cuộn khi thiếu chiều cao. Tên dài được rút gọn trong hàng, badge không co avatar. Kích thước nội dung nền tảng dùng cùng mốc với sidebar.

Kiểm tra bố cục cách ly: `node scripts/sidebar-layout-check.mjs` sau `npm run build` (940×640,1024×720,1280×840; sáu tài khoản, cả hai chế độ).


## Giao diện 0.5.0

Giao diện theo prototype đã duyệt: nền sáng Ivory/tối Graphite, sidebar gọn, tài khoản ghim, bảng chuyển nhanh và cài đặt chia theo mục. Nội dung chat tiếp tục là web chính thức của từng nền tảng.

- **⌘K** tìm tài khoản hoặc thao tác, hỗ trợ gõ không dấu; ↑/↓ chọn, Enter mở, Escape quay lại. Mở từ trang chat vẫn dùng được; bảng chuyển nhanh không chồng lên hộp thêm/đổi tên tài khoản.
- Kéo đường phân cách sidebar trong khoảng **200–300px**, nhấp đúp về **224px**. Khi đường phân cách có focus: ←/→ thay đổi, Home/End chọn giới hạn. Thu gọn còn **72px**.
- **Tài khoản**: lọc theo nền tảng, ghim/bỏ ghim, đổi tên; menu **…** sắp xếp và gỡ khỏi sidebar. Khôi phục vẫn dùng đúng phiên cũ.
- **Giao diện**: chọn Sáng/Tối, Theo macOS hoặc Theo nền tảng (mặc định, giữ khả năng đồng bộ màu cũ). Lựa chọn áp dụng cho khung app; từng nền tảng tự quản lý giao diện chat.
- **Thông báo** và **macOS** có mục riêng; giữ quyền thông báo từng tài khoản, tạm dừng, Cmd+W, phím tắt và chạy cùng máy.

Nâng cấp không đổi `TinNhanDesktop`, `accounts.json` hay ID/partition của tài khoản. Màu, chiều rộng và tài khoản ghim được lưu thêm trong `window.json`. Không nhập lại cookie hoặc yêu cầu quét QR chỉ vì nâng cấp giao diện.

```sh
npm run test:shell
```

Kiểm tra cách ly gồm12 tổ hợp màn hình/sáng-tối/sidebar, bàn phím và focus native, không chồng hộp thoại, giữ view/bản nháp, tên an toàn, kéo kích thước, lưu giao diện và ID tài khoản qua thoát/mở lại. Các fixture không dùng phiên cá nhân. Phần này ghi lại giao diện 0.5.0; bản hiện hành và link tải ở đầu tài liệu.
