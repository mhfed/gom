# Sửa popup chat nổi

Theo yêu cầu sau bản 0.8.0:

- Sau khi tách tab sang cửa sổ nổi và áp dụng kích thước popup, tải lại trang đúng một lần để nền tảng khởi tạo bố cục theo khung nhỏ.
- Thu/mở bong bóng hoặc bấm mở lại popup đang tồn tại không tải lại trang. Đưa tab về Gom không tải lại.
- Bong bóng còn 60% đường kính cũ: 60px → 36px; logo 44px → 26px. Native window 48×48px giữ khoảng đệm cho bóng và kéo/bám góc.

Việc tải lại lúc tách là thay đổi có chủ đích so với 0.8.0. Phiên đăng nhập/partition vẫn giữ; bản nháp chưa lưu trước lần tải lại phụ thuộc nền tảng. Bản nháp gõ sau khi popup đã tải được giữ qua thu/mở bong bóng.

Nhắc trả lời được giữ riêng trên nhánh `codex/reply-reminders`, commit WIP `20aebfb`; bản sửa popup không chứa chức năng đang phát triển đó.

## Kiểm chứng

- Typecheck và toàn bộ 178 unit test đạt.
- Regression mới đã thất bại khi chưa có reload, sau đó đạt ở bản sửa.
- Đủ 12 nhóm Electron chat nổi đạt bằng profile tạm và trang giả. Xác nhận đúng một DOMContentLoaded mới sau mỗi lần tách mới, viewport khởi tạo vừa popup, giữ WebContents/partition và không tải lại khi thu/mở/đưa về.
- Kích thước DOM bong bóng 36×36 và native window 48×48 đã được kiểm tra thực tế trong fixture; kéo/bám góc và quyền riêng tư vẫn đạt.
- Review độc lập không còn P1/P2. Việc mỗi nền tảng thực tế chọn giao diện mobile còn phụ thuộc cách nền tảng đó xử lý viewport.

Đã build mã nguồn để kiểm thử. Chưa tạo bộ cài hoặc thay ứng dụng đang cài trên máy trong lần sửa này.
