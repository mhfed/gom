# Đổi logo nền tảng

## Mục đích

Cho bạn thay logo cố định của một nền tảng bằng icon có sẵn trong Gom hoặc ảnh PNG/JPG của bạn. Logo tùy chỉnh thuộc về nền tảng, nên mọi tab, thư viện nền tảng và chỗ khác hiển thị nền tảng đó dùng cùng một icon. Lựa chọn được giữ trong dữ liệu Gom trên máy qua các lần cập nhật.

## Thiết kế đã chọn

- Mở menu chuột phải trên tab nền tảng và chọn **Đổi logo**.
- Hộp chọn logo có thư viện icon đi kèm Gom và nút chọn ảnh PNG/JPG từ máy.
- Ảnh được cắt vuông, thu nhỏ để dùng làm icon; không tải ảnh từ URL và không hỗ trợ SVG tùy ý.
- Có lựa chọn **Khôi phục logo mặc định** cho từng nền tảng.
- Logo thay đổi áp dụng theo ID nền tảng, không theo tài khoản; các tài khoản cùng nền tảng cùng dùng một logo.
- Logo là dữ liệu giao diện cục bộ, không thay đổi tên, URL, cookie hay phiên đăng nhập của dịch vụ và không đồng bộ qua máy khác.
- Khi chưa có lựa chọn tùy chỉnh, app giữ nguyên logo hiện tại hoặc chữ viết tắt của website riêng.

## Các hướng đã cân nhắc

- Chỉ chọn trong thư viện: đơn giản, chạy offline, nhưng không thể dùng logo riêng.
- Chỉ chọn ảnh PNG/JPG: linh hoạt, nhưng người dùng phải chuẩn bị ảnh.
- Kết hợp thư viện và ảnh — **đã chọn**: đổi nhanh bằng icon có sẵn, vẫn cho phép dùng logo riêng.

## Phạm vi và giới hạn

- Áp dụng cho nền tảng có sẵn và website riêng.
- Mỗi nền tảng có tối đa một logo tùy chỉnh.
- Không có nhập ảnh SVG, URL từ Internet, đồng bộ cloud, hay thay đổi icon app/macOS Dock/Windows taskbar.
- Cần lưu logo theo ID nền tảng trong dữ liệu người dùng để không mất khi app nâng cấp; chi tiết định dạng lưu và xử lý ảnh là quyết định triển khai.

## Tiêu chí hoàn thành

- Có thể đổi logo từ tab bằng chuột phải, chọn icon hoặc ảnh, và khôi phục logo mặc định.
- Thay đổi hiển thị nhất quán ở thanh tab, thư viện nền tảng và giao diện khác dùng logo nền tảng.
- Logo lưu trên máy và giữ nguyên sau khi thoát/mở lại app.
- Ảnh sai định dạng hoặc không đọc được không làm hỏng catalog hay logo đang dùng.
- Không chạy build/release nếu chưa được bạn hỏi và xác nhận riêng.
