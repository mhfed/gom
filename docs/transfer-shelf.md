# Khay trung chuyển

Khay là ngăn giữ nhiều nội dung để dùng lại khi chuyển giữa các nền tảng và tài khoản trong Gom. Nội dung được lưu trên máy và còn nguyên sau khi thoát, mở lại app.

Khay có trong [Gom 0.8.1](https://github.com/mhfed/gom/releases/tag/v0.8.1), phát hành ngày 29/10/2026 cho Mac Apple Silicon và Windows x64. Xem [kết quả kiểm chứng 0.8.1](verification-0.8.1.md). Bản 0.8.0 chưa có Khay.

## Thêm nội dung

Bấm **Khay** trên thanh công cụ. Khi cửa sổ đủ rộng, khay nằm bên phải và trang chat tiếp tục ở bên cạnh; trên màn hình nhỏ, đóng khay để trở lại trang chat.

- **Thêm chữ:** nhập hoặc dán nội dung vào ô rồi bấm Thêm chữ. Xuống dòng và khoảng cách được giữ lại.
- **Lấy từ clipboard:** sao chép chữ, liên kết hoặc ảnh rồi bấm nút này. Gom chỉ đọc nội dung vừa sao chép khi bạn bấm nút.
- **Chọn tệp…:** chọn tối đa 10 tệp mỗi lần. Gom giữ bản sao tại thời điểm thêm, nên sửa hoặc xóa tệp gốc không làm đổi nội dung trong khay. Ảnh PNG/JPEG hợp lệ được hiển thị bằng thumbnail.
- Trên trang chat, chọn chữ hoặc mở menu chuột phải của một liên kết rồi chọn **Lưu đoạn chọn vào Khay** hoặc **Lưu liên kết vào Khay**.

Mỗi không gian giữ tối đa 100 món, tổng 250 MiB. Mỗi tệp/ảnh tối đa 50 MiB; chữ tối đa 64 KiB. Ảnh PNG/JPEG để xem và sao chép tối đa 16 triệu điểm ảnh. Gom báo khi vượt giới hạn; bạn có thể xóa bớt trước khi thêm.

## Dùng lại và sắp xếp

Tìm theo chữ hoặc tên tệp, hoặc lọc loại nội dung. Bấm biểu tượng ghim để giữ món hay dùng ở trên cùng.

| Nội dung  | Cách dùng lại                                                            |
| --------- | ------------------------------------------------------------------------ |
| Chữ, link | Bấm **Sao chép**, chuyển sang cuộc chat và dán                           |
| Ảnh       | Bấm **Sao chép**, rồi dán ở nền tảng hỗ trợ dán ảnh                      |
| Tệp       | Bấm **Lưu bản sao…**, chọn nơi lưu, rồi đính kèm bằng giao diện nền tảng |

Bạn chọn người nhận, kiểm tra nội dung và bấm gửi trong nền tảng đang dùng. Khả năng dán ảnh hoặc đính kèm phụ thuộc nền tảng đó. Bản đầu dùng nút chọn tệp và lưu bản sao; kéo tệp trực tiếp giữa khay và cuộc chat chưa có.

Xóa từng món bằng nút X. **Dọn mục chưa ghim** hiển thị số món trước khi bạn xác nhận và giữ nguyên các món đã ghim. Xóa trong khay không xóa tệp gốc hay bản sao bạn đã lưu ra ngoài.

## Mẫu trả lời

Mở mục **Mẫu** trong Khay để tạo câu trả lời thường dùng. Mỗi mẫu có tên và nội dung; bạn có thể tìm theo cả hai, sửa hoặc xóa mẫu. Tên tối đa 120 ký tự Unicode, nội dung tối đa 64 KiB, tối đa 100 mẫu trong mỗi không gian.

Bấm **Sao chép** cạnh mẫu để chép nội dung vào clipboard. Sau đó bạn tự chọn cuộc trò chuyện, dán, kiểm tra rồi gửi trong nền tảng. Gom không tự chèn mẫu vào ô soạn và không tự gửi tin.

Để thay thông tin mỗi lần dùng, viết biến trong hai dấu ngoặc nhọn, ví dụ `Chào {{Tên khách}}, đơn {{Mã đơn}} của bạn đã được gửi.`. Mỗi mẫu dùng tối đa 20 nhãn khác nhau; nhãn dài 1–60 ký tự. Khi bấm **Sao chép**, điền giá trị tối đa 500 ký tự cho từng nhãn, xem trước nội dung hoàn chỉnh rồi bấm **Sao chép** lần nữa. Nhãn lặp lại trong cùng mẫu dùng chung một giá trị; nhãn không phân biệt chữ hoa/thường. Bấm **Hủy** hoặc đóng Khay sẽ bỏ các giá trị vừa nhập. Gom không lưu chúng vào mẫu và không tự gửi nội dung.

## Không gian và dữ liệu

Không gian thường và Không gian kín có Khay và Mẫu riêng. Nội dung được lưu mã hóa trên máy, không đưa vào bản sao lưu cấu hình hay đồng bộ mạng. Khi đổi không gian hoặc khóa, Gom đóng khay, xóa nội dung đang hiển thị và hủy các thao tác chưa hoàn tất thuộc không gian cũ. Di chuyển tài khoản giữa hai không gian không tự di chuyển các món trong khay.

Kho Khay được mã hóa trên máy bằng khóa do tài khoản hệ điều hành bảo vệ. Mật khẩu Không gian kín khóa quyền truy cập qua giao diện Gom. Nội dung bạn đã chủ động sao chép vào clipboard hoặc lưu ra ngoài vẫn ở ngoài Gom sau khi khóa.

Nếu kho Khay hoặc khóa hệ điều hành chưa đọc được, Gom báo lỗi và giữ dữ liệu hiện có. Không xóa hay thay tệp dữ liệu để tự đặt lại khay; cần xử lý nguyên nhân trước khi dùng tiếp.

## Kiểm chứng

Các fixture dùng tài khoản, clipboard, hộp thoại, file và hồ sơ giả trong thư mục tạm. Kiểm tra gồm lưu qua lần mở lại, đúng byte file, khay thường/kín, callback cũ sau khóa, bố cục native, bản nháp và chat nổi. Xem [kết quả kiểm chứng](verification-transfer-shelf.md); kiểm tra giả không thay thế thử dán nội dung trên tài khoản thật.
