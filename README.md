# Tin nhắn — macOS

Ứng dụng cá nhân bọc giao diện web chính thức của Zalo, Messenger và Telegram. Sidebar chuyển giữa ba khung độc lập; mỗi khung dùng một partition cố định và không bị tạo lại khi đổi nền tảng.

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

- Messenger: mở Tài khoản & cài đặt, chọn hồ sơ Chrome, bấm Dùng phiên có sẵn. Hồ sơ ưu tiên của bản cá nhân là hồ sơ anh đã chỉ định. Chỉ hai cookie Facebook cần thiết được đọc bằng SQLite ở chế độ chỉ đọc và giải mã qua Chrome Safe Storage trong Keychain.
- Phiên được thử trong cửa sổ tạm trước; chỉ chấp nhận sau khi Messenger đích đã xác minh đăng nhập. Thất bại sẽ khôi phục cặp cookie cũ. Đóng app trong lúc nhập sẽ đợi giao dịch kết thúc.
- Zalo và Telegram: đăng nhập QR trực tiếp trên giao diện chính thức. Nếu nền tảng thu hồi hoặc hết hạn phiên, phải đăng nhập lại.
- Dữ liệu của app lưu tại `~/Library/Application Support/TinNhanDesktop`. Không sao chép toàn bộ Chrome profile; không xuất token ra log hoặc renderer.
- Đóng cửa sổ hoặc Cmd+Q sẽ thoát app sau khi ghi dữ liệu. Chuyển sidebar giữ nguyên view và bản nháp đang mở; khôi phục bản nháp sau thoát phụ thuộc chính nền tảng.

## Kiểm thử

```sh
npm test
npm run test:persistence
npm run test:live
```

`test:persistence` dùng dữ liệu giả ở `../persistence-fixture`, chạy hai tiến trình Electron để kiểm tra cookie bền vững, localStorage, IndexedDB, cách ly ba partition và tái sử dụng view.

`test:live` là harness phát triển riêng, không được đóng gói vào app. Nó mở bản app đã đóng gói trên phiên cá nhân thật; chỉ chạy trong phạm vi người dùng đã đồng ý. Lệnh stdin: `status`, `activate zalo`, `activate messenger`, `activate telegram`, `settings`, `import Default`, `resize 1024x720`, `screenshot`, `quit`, `launch`. `import` chỉ dùng khi chủ tài khoản yêu cầu. Không gửi tin nhắn trong các kiểm thử.

Remote views có sandbox, context isolation, tắt Node và không có preload đặc quyền. IPC chỉ nhận từ main frame của shell cục bộ; popup nội bộ giữ đúng session; link HTTP(S) bên ngoài yêu cầu xác nhận trước khi mở trình duyệt.

## Sidebar và số chưa đọc 0.2.0

Nút bên trái tiêu đề thu gọn/mở rộng sidebar; lựa chọn được lưu khi thoát. Logo gốc được đóng gói cục bộ, xem src/renderer/logos/SOURCES.md. Ba nền tảng được mở nền để cập nhật chỉ báo mỗi4giây.

Badge theo số nền tảng cung cấp: Telegram đọc mục Unread/Chưa đọc; Zalo đọc chỉ báo trên thanh điều hướng tin nhắn; Messenger ưu tiên số trên tiêu đề/tab và chỉ báo hội thoại chưa đọc. Số có + là cận dưới trong phần danh sách đã tải hoặc số đã được nền tảng rút gọn. Ký hiệu — nghĩa là chưa có số đáng tin cậy; số0 được ẩn. Hiện phiên Messenger khảo sát không cung cấp tổng số qua các chỉ báo hỗ trợ, nên hiển thị —. Bộ thu chỉ trả về số, không chuyển nội dung tin nhắn về shell.
