# Không gian làm việc có tên

## Mục tiêu

Cho phép lưu nhiều bố cục tab theo tên, rồi chuyển lại nhanh giữa chúng. Mỗi bố cục lưu danh sách nền tảng đang mở, tài khoản đang chọn, kích thước thanh bên, giao diện và trạng thái bảng điều khiển.

## Hành vi

- Có một bố cục mặc định luôn tồn tại và tối đa 12 bố cục do người dùng lưu trong mỗi vùng riêng tư.
- Người dùng lưu bố cục hiện tại thành không gian mới, chọn một không gian để khôi phục, hoặc xóa không gian đang chọn.
- Tên dài tối đa 32 ký tự, không được trùng trong cùng vùng riêng tư.
- Không gian thường và không gian kín có danh sách riêng. Bố cục kín chỉ được chiếu renderer khi đã mở khóa; chuyển vùng sẽ lưu bố cục hiện tại trước khi khôi phục vùng đích.
- Không gian có tên không thay đổi quyền sở hữu tài khoản. Tài khoản vẫn thuộc vùng thường/kín như hiện tại.
- Cấu hình được lưu trong `window.json` cùng dữ liệu điều hướng hiện tại; migration giữ nguyên bố cục cũ làm mặc định.

## Giới hạn

- Đây là các bố cục điều hướng, không phải đồng bộ đám mây hoặc bộ chứa tài khoản riêng.
- Cookie, phiên đăng nhập và nội dung nền tảng vẫn dùng partition của từng tài khoản.
- Tạo bản sao bố cục chỉ lưu trạng thái tab/account và giao diện, không sao chép phiên đăng nhập.
