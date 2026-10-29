# Kiểm chứng chat nổi — Gom 0.8.0

Bản build Mac Apple Silicon ngày 29/10/2026, triển khai theo mock đã được người dùng duyệt.

- Typecheck đạt; toàn bộ 178 unit test đạt.
- 12 nhóm Electron chat nổi đạt trên ASAR đóng gói: giữ nguyên native view, session và bản nháp; thu/mở; ghim; kéo/bám góc; đưa về Gom; ẩn main thường; khóa và IPC cũ; gỡ tài khoản/đóng tab; phím tải lại/quay lại đúng cửa sổ; thoát sạch.
- 17 nhóm không gian kín đạt trên cùng ASAR đóng gói.
- UI shell kiểm tra ở chiều rộng 340px, gồm nút ghim/đưa về/thu gọn, Escape, phân biệt kéo và bấm bong bóng, xóa metadata khi thu hồi.
- Có kiểm thử RED trước khi triển khai và trước khi sửa hai trường hợp: native shortcut điều khiển nhầm main, và ẩn main thường trong lúc shell nổi đang tải.
- Review độc lập đã kiểm tra quyền IPC, sở hữu native view, tác vụ tải muộn, khóa không gian, layout/focus và vòng đời; không còn P1/P2.
- `npm run make`, chữ ký ad-hoc, DMG, ZIP và 23 file runtime trong ASAR đều được kiểm tra. Mount DMG chỉ đọc xác nhận version, ASAR, liên kết Applications và launcher.
- Đã cài vào Applications và mở Gom 0.8.0; app 0.7.9 được sao lưu trước khi thay. ASAR đã cài có SHA-256 `2ff2e93545f5e755c1855e3c17b41d0967b913fa32de6dc684e0ea4ed71eaffa`, khớp bản đóng gói.

Fixture dùng profile tạm, mock Keychain và trang giả; không đọc tài khoản cá nhân. Bản nháp được chứng minh giữ qua thu/mở/đưa về trong cùng lần chạy; khả năng giữ bản nháp sau thoát app vẫn tùy nền tảng.

Bộ cài, checksum và biên bản máy ở `outputs/builds/0.8.0/`, không đưa vào Git hoặc gói app. Đây là build/cài tại máy; chưa công bố GitHub Release 0.8.0.
