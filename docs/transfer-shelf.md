# Khay trung chuyển

Khay là ngăn giữ nhiều nội dung để dùng lại khi chuyển giữa các nền tảng và tài khoản trong Gom. Nội dung được lưu trên máy và còn nguyên sau khi thoát, mở lại app.

Tính năng hiện ở nhánh phát triển `codex/transfer-shelf`; bản phát hành 0.8.0 và bản đang cài trên máy chưa có Khay.

## Thêm nội dung

Bấm **Khay** trên thanh công cụ. Khi cửa sổ đủ rộng, khay nằm bên phải và trang chat tiếp tục ở bên cạnh; trên màn hình nhỏ, đóng khay để trở lại trang chat.

- **Thêm chữ:** nhập hoặc dán nội dung vào ô rồi bấm Thêm chữ. Xuống dòng và khoảng cách được giữ lại.
- **Lấy từ clipboard:** sao chép chữ, liên kết hoặc ảnh rồi bấm nút này. Gom chỉ đọc nội dung vừa sao chép khi bạn bấm nút.
- **Chọn tệp…:** chọn tối đa 10 tệp mỗi lần. Gom giữ bản sao tại thời điểm thêm, nên sửa hoặc xóa tệp gốc không làm đổi nội dung trong khay. Ảnh PNG/JPEG hợp lệ được hiển thị bằng thumbnail.
- Trên trang chat, chọn chữ hoặc mở menu chuột phải của một liên kết rồi chọn **Lưu đoạn chọn vào Khay** hoặc **Lưu liên kết vào Khay**.

Mỗi không gian giữ tối đa 100 món, tổng 250 MiB. Mỗi tệp/ảnh tối đa 50 MiB; chữ tối đa 64 KiB. Ảnh PNG/JPEG để xem và sao chép tối đa 16 triệu điểm ảnh. Gom báo khi vượt giới hạn; bạn có thể xóa bớt trước khi thêm.

## Dùng lại và sắp xếp

Tìm theo chữ hoặc tên tệp, hoặc lọc loại nội dung. Bấm biểu tượng ghim để giữ món hay dùng ở trên cùng.

| Nội dung | Cách dùng lại |
| --- | --- |
| Chữ, link | Bấm **Sao chép**, chuyển sang cuộc chat và dán |
| Ảnh | Bấm **Sao chép**, rồi dán ở nền tảng hỗ trợ dán ảnh |
| Tệp | Bấm **Lưu bản sao…**, chọn nơi lưu, rồi đính kèm bằng giao diện nền tảng |

Bạn chọn người nhận, kiểm tra nội dung và bấm gửi trong nền tảng đang dùng. Khả năng dán ảnh hoặc đính kèm phụ thuộc nền tảng đó. Bản đầu dùng nút chọn tệp và lưu bản sao; kéo tệp trực tiếp giữa khay và cuộc chat chưa có.

Xóa từng món bằng nút X. **Dọn mục chưa ghim** hiển thị số món trước khi bạn xác nhận và giữ nguyên các món đã ghim. Xóa trong khay không xóa tệp gốc hay bản sao bạn đã lưu ra ngoài.

## Không gian và dữ liệu

Không gian thường và Không gian kín có khay riêng. Khi đổi không gian hoặc khóa, Gom đóng khay, xóa nội dung đang hiển thị và hủy các thao tác chưa hoàn tất thuộc không gian cũ. Di chuyển tài khoản giữa hai không gian không tự di chuyển các món trong khay.

Kho Khay được mã hóa trên máy bằng khóa do tài khoản hệ điều hành bảo vệ. Mật khẩu Không gian kín khóa quyền truy cập qua giao diện Gom. Nội dung bạn đã chủ động sao chép vào clipboard hoặc lưu ra ngoài vẫn ở ngoài Gom sau khi khóa.

Nếu kho Khay hoặc khóa hệ điều hành chưa đọc được, Gom báo lỗi và giữ dữ liệu hiện có. Không xóa hay thay tệp dữ liệu để tự đặt lại khay; cần xử lý nguyên nhân trước khi dùng tiếp.

## Kiểm chứng

Các fixture dùng tài khoản, clipboard, hộp thoại, file và hồ sơ giả trong thư mục tạm. Kiểm tra gồm lưu qua lần mở lại, đúng byte file, khay thường/kín, callback cũ sau khóa, bố cục native, bản nháp và chat nổi. Xem [kết quả kiểm chứng](verification-transfer-shelf.md); kiểm tra giả không thay thế thử dán nội dung trên tài khoản thật.
