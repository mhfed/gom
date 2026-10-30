# Header B — Một hàng gọn

Thay đổi trong mã nguồn, chưa nằm trong bộ cài 0.8.2. Không cần thay đổi tài khoản hay đăng nhập lại.

Thanh trên cùng giữ chiều cao 52 px. Nền tảng đang dùng hiện tên và logo, kể cả khi ghim; những nền tảng khác chỉ hiện logo và số chưa đọc. Tên dài có tooltip đầy đủ. Khi thiếu chỗ, tab đang chọn vẫn hiện và các tab còn lại vào menu tab ẩn. Thứ tự ghim và phím điều hướng vẫn được giữ.

| Muốn làm gì                                  | Điểm vào                                                      |
| -------------------------------------------- | ------------------------------------------------------------- |
| Mở nền tảng hoặc website                     | **+ → Mở nền tảng / website…**                                |
| Thêm tài khoản                               | **+ → Thêm tài khoản…** hoặc menu tên tài khoản               |
| Đổi tài khoản cùng nền tảng                  | Bấm tên tài khoản                                             |
| Tách chat nổi                                | Menu tên tài khoản hoặc **··· → Tách thành chat nổi**         |
| Ghim, bỏ ghim, đóng tab                      | Chuột phải trên tab hoặc **Shift F10**                        |
| Đặt phiên Tập trung                          | **··· → Tập trung…**                                          |
| Xem/đổi phiên Tập trung đang chạy            | Bấm chip đồng hồ trên header                                  |
| Đổi sáng/tối                                 | **··· → Đổi sáng / tối**                                      |
| Cài đặt, Tài nguyên, Sao lưu                 | Menu **··· Công cụ**                                          |
| Lùi, trang chủ, tải lại, mở bằng trình duyệt | Phần thao tác trang trong **···** khi đang có trang dùng được |
| Khay và Nhắc trả lời                         | Biểu tượng kẹp giấy và chuông                                 |
| Đổi/khóa không gian                          | **Thường / Kín**, giữ title và nhãn truy cập đầy đủ           |

Huy hiệu cập nhật ứng dụng nằm trên nút Công cụ; chọn Cài đặt khi có cập nhật sẽ vào mục Cập nhật. Chip Tập trung hiện giờ kết thúc cả ở cửa sổ 940 px. Khay chỉ hiện số khi có món.

Menu Công cụ vẫn mở được tại Cài đặt, thư viện nền tảng, không gian trống và khi trang bị lỗi. Chat nổi và thao tác trang chỉ bật khi có trang phù hợp. Menu tài khoản chỉ liệt kê tài khoản cùng nền tảng trong không gian hiện tại. Lựa chọn cũ bị hủy nếu đổi tài khoản, trang giao diện hoặc không gian trong lúc menu đang mở.

Đổi tab và mở các trang cài đặt không dựng lại trang chat. Cơ chế đăng nhập, ngủ tài khoản, thông báo, Tập trung, sao lưu và khóa không gian giữ nguyên. Chat nổi tiếp tục hành vi tải lại ban đầu đã mô tả trong [hướng dẫn chat nổi](floating-chat.md); header chỉ đổi chỗ truy cập.

Chạy từ checkout này bằng `npm start`. Kiểm tra header bằng `npm run test:header`. Xem [kết quả kiểm chứng](verification-header-compact.md).
