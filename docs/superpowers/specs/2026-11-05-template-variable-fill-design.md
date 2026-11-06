# Cá nhân hóa mẫu trả lời

Ngày: 2026-11-05. Trạng thái: **đã duyệt; triển khai theo biến `{{nhãn}}`**.

## Mục đích

Cho phép tái sử dụng một mẫu trả lời mà vẫn điền được chi tiết riêng cho từng khách, ngay trong Khay của Gom.

## Các cách đã cân nhắc

1. **Tự nhận diện biến trong nội dung mẫu — đã chọn.** Người dùng viết `{{Tên khách}}`, `{{Mã đơn}}`; khi bấm Sao chép, Gom hỏi giá trị cho mỗi biến khác nhau, hiện bản xem trước rồi chép. Cách này bổ sung trực tiếp lên thư viện mẫu hiện có và không cần quản lý thêm cấu hình.
2. **Khai báo từng trường trong trình sửa mẫu.** Có thể đặt nhãn, giá trị mặc định và thứ tự trường rõ ràng hơn, nhưng làm thao tác tạo mẫu dài hơn.
3. **Tự điền từ hồ sơ khách hàng.** Giảm nhập lại, nhưng cần thiết kế sổ khách hàng và cách liên kết dữ liệu trước.

## Phạm vi

- Nội dung mẫu vẫn là văn bản thường được lưu trong Khay mã hóa hiện có; cú pháp `{{nhãn}}` xác định các trường cần hỏi khi dùng mẫu.
- Mỗi nhãn khác nhau xuất hiện một lần trong form; các lần xuất hiện lặp trong nội dung nhận cùng một giá trị. Thứ tự form theo lần xuất hiện đầu tiên trong mẫu.
- Khi mẫu có biến, nút Sao chép mở form điền ngay trong Gom. Người dùng xem trước nội dung đã thay thế rồi bấm **Sao chép** rõ ràng; **Hủy** không đổi clipboard.
- Mẫu không có biến giữ nguyên hành vi Sao chép hiện tại.
- Giá trị chỉ tồn tại tạm trong thao tác đang mở; xóa chúng sau khi hủy, sao chép xong, đóng Khay, khóa Không gian kín hoặc đổi không gian.

## Ranh giới

- Không tự đọc chat, clipboard hay dữ liệu khách hàng; không tự điền từ nền tảng, tự chèn vào ô soạn, gửi tin hoặc đồng bộ qua mạng.
- Nội dung xem trước được hiển thị như văn bản thuần. Chuỗi biến không khớp cú pháp đầy đủ được giữ nguyên như văn bản thường.
- Sao chép phải tiếp tục qua thao tác clipboard có kiểm tra không gian/phiên như các hành động Khay hiện tại; giá trị điền không được ghi log hoặc lưu vào mẫu.
- Mẫu thường và kín tiếp tục dùng kho riêng của từng không gian.

## Phần để triển khai chốt

Người triển khai chốt giới hạn số trường, độ dài nhãn/giá trị và cách báo lỗi đầu vào để giao diện luôn dùng được với giới hạn nội dung Khay. Cần kiểm chứng thay thế lặp, mẫu không có biến, hủy, bản xem trước, dữ liệu độc hại dạng văn bản, thao tác khóa/đổi không gian trong lúc form đang mở, và hành vi Khay hiện tại.
