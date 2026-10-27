# Tab đang mở và website riêng — 27/10/2026

Triển khai theo mock “Tab đang mở” đã được duyệt. Header giữ chiều cao 52px;
tab nền tảng và tài khoản là hai lớp riêng.

## Hành vi

- Tab thường có tên và nút đóng; tab ghim thu gọn thành logo hoặc chữ viết tắt.
  Nhấp chuột phải để ghim, bỏ ghim hoặc đóng. Thư viện cũng có nút ghim.
- Chiều rộng cửa sổ quyết định số tab hiển thị. Tab đang dùng luôn có chỗ;
  các tab còn lại nằm trong menu native, hiển thị được trên trang website.
- Nút **+** cạnh tab mở thư viện có tìm kiếm và form tên/URL để thêm website.
  Nút **+** bên cạnh bộ chọn tài khoản tiếp tục tạo tài khoản riêng.
- Đóng tab giữ tài khoản và dữ liệu đăng nhập. Website riêng đóng view sau
  khi ghi dữ liệu phiên; mở lại dùng cùng partition. Đóng hết tab về thư viện.
- Danh sách mở, ghim và tài khoản cuối của mỗi nền tảng được lưu qua khởi động
  lại. Website riêng chỉ tạo view khi được mở để sử dụng.
- Cài đặt, hộp thoại tài khoản, thông báo và chuyển nhanh nhận danh sách nền
  tảng động. Bộ lọc tài khoản chuyển thành select khi danh sách dài.

## Dữ liệu và quyền truy cập

Catalog v2 lưu định nghĩa website cùng tài khoản đầu tiên bằng một lần ghi
atomic. Chuyển từ v1 giữ nguyên ID, partition, tên ứng dụng mã hóa và dữ liệu
phiên cũ. Catalog hỏng vẫn được bảo vệ bằng backup và chế độ chỉ đọc.

URL phải dùng HTTP hoặc HTTPS, không chứa thông tin đăng nhập. Quyền điều
hướng và thông báo của website riêng chỉ áp dụng cho origin đã cấu hình.
Website không nhận bridge đặc quyền của shell; tài khoản dùng partition riêng,
kể cả khi nhiều website có cùng origin. Gom không đoán số tin chưa đọc của
website riêng. Biểu tượng dự phòng dùng chữ viết tắt, không tải favicon ngoài.

Đăng nhập SSO chuyển sang origin khác có thể chưa hoạt động đầy đủ trong app.
Website tự chịu trách nhiệm lưu bản nháp; đóng tab có thể mất nội dung chưa
được website lưu. Luồng đóng các nền tảng có sẵn giữ view phục vụ thông báo.

## Kiểm chứng

- Typecheck, build và 150 unit test đạt; có kiểm tra migration, URL/origin,
  lưu catalog, trạng thái tab và tính toán overflow.
- `scripts/provider-tabs-check.mjs`: fixture Electron với HTTP server cục bộ,
  HOME tạm và mock keychain. Kiểm tra thêm website bằng form thật, IPC,
  cô lập cookie/localStorage, ghim, native menu, đóng/mở và khởi động lại.
  Toàn bộ 15 nhóm kiểm tra đạt, không có lỗi renderer.
- Kiểm tra 19 nền tảng có tên dài ở cửa sổ 940px, cả tab thường và tất cả tab
  ghim; tất cả mục overflow truy cập được. Đã xem ảnh giao diện sáng/tối.
- `scripts/native-tabs-check.mjs`: 16 nhóm kiểm tra đạt, gồm focus, bản nháp,
  52px header, native account menu và không sửa DOM khi state không đổi.
- `scripts/command-focus-check.mjs`: trả focus và tránh chồng hộp thoại đạt.
- `scripts/settings-ui-check.mjs`: năm trang Cài đặt, ba kích thước ở hai
  theme và các nhóm hành vi control đều đạt.
- `scripts/multi-account-check.mjs`: sáu tài khoản, dữ liệu phiên cũ,
  import giả lập, thông báo, lưu trữ và khôi phục qua khởi động lại đều đạt.

Review độc lập phát hiện các trường hợp điều hướng tạo view của tab đã đóng,
quay lại từ Cài đặt mở lại tab đã đóng, khôi phục tài khoản tải website sớm,
và quay lại khi không còn tab/tài khoản dùng được. Đã tái hiện từng lỗi bằng
kiểm tra thất bại, sửa rồi chạy đạt. Quay lại chỉ chọn tab còn tài khoản hoạt
động; nếu không có thì về thư viện và ẩn nút quay lại của thư viện.

Các kiểm tra GUI chạy tuần tự, không dùng dữ liệu tài khoản thật. Kết quả JSON
và ảnh nằm trong `outputs/provider-tabs/`, `outputs/native-tabs/` và
`outputs/settings-ui/` (không đưa vào Git).

Phần triển khai này được đưa vào bản 0.7.0 theo yêu cầu đóng gói và phát hành
tiếp theo; xem [kiểm chứng bộ cài](release-0.7.0.md).
