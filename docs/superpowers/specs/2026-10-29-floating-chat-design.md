# Chat nổi Gom

Người dùng đã duyệt mock chat nổi và yêu cầu triển khai, build, cài trên máy. Mock: `/Users/dongvi/.codex/visualizations/2026/10/28/01a18149-f616-7561-9ddd-9b5dff0e5591/gom-floating-chat.html`.

- Một tab tài khoản đang dùng được tách thành cửa sổ nổi. Dùng lại chính WebContentsView, partition và trang hiện có; không tạo giao diện chat tổng hợp hay đọc thêm tin nhắn.
- Thanh điều khiển Gom 45px: nhận diện nền tảng/tài khoản, bật/tắt luôn nổi, đưa về Gom, thu thành bong bóng. Cửa sổ ban đầu 400×560, có thể kéo và đổi kích thước trong workArea.
- Bong bóng logo Gom 60px trong cửa sổ trong suốt 72px, ở góc dưới trái/phải. Kéo để đổi góc, tự bám vào cạnh an toàn; bấm để mở lại đúng tab. Escape thu gọn.
- Giữ nguyên trang, bản nháp, lịch sử và phiên qua tách/thu/mở/đưa về. Chỉ một tab nổi cùng lúc; tách tab khác trả tab trước về Gom.
- Ẩn/thu nhỏ cửa sổ chính không đóng chat nổi thường. Chuyển không gian, khóa không gian kín, khóa màn hình và máy ngủ thu hồi cửa sổ nổi/bong bóng. IPC cũ không được làm xuất hiện lại nội dung.
- Gỡ tài khoản hoặc đóng tab nền tảng phải thu hồi chat nổi trước khi đóng trang. Thoát app ghi phiên như cũ và đóng mọi cửa sổ.
- Main hiển thị trạng thái tab đang nổi cùng nút mở lại/đưa về; không để trang trắng hoặc tạo trang thứ hai.
- Chỉ shell local chính xác của cửa sổ nổi/bong bóng được gọi IPC điều khiển. Renderer nền tảng không có quyền điều khiển native window.

Triển khai dùng controller riêng, preload riêng và shell riêng với CSP nghiêm ngặt. Quyền truy cập tài khoản thuộc không gian đang mở do main kiểm tra trên mọi thao tác. Vị trí và kích thước được nhớ trong lần chạy hiện tại; khởi động lại ở Gom chính để giữ chính sách khóa.

Phạm vi giao hàng: bản build Mac Apple Silicon cài vào máy người dùng, có sao lưu ứng dụng trước khi thay. Không tự công bố GitHub Release mới trong yêu cầu build/cài này.
