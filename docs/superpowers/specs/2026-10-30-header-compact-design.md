# Header B — Một hàng gọn

2026-10-30. Người dùng đã xem ba mock cục bộ và chọn: “hướng B đi”. Tài liệu ghi lại hướng B đã được chọn, không mở thêm vòng duyệt. Base `55bf81c`.

## Giao diện được chọn

Giữ chiều cao **52 px** và khoảng trống traffic lights 94 px trên Mac. Logo Gom chỉ giữ biểu tượng. Nền tảng đang dùng luôn có tên (kể cả ghim), các nền tảng khác chỉ có logo và badge số chưa đọc. Giữ thứ tự ghim, điều hướng bàn phím, title/aria-label và menu quản lý tab. Bỏ nút đóng trên từng tab; đóng/ghim qua chuột phải hoặc Shift F10. Giữ active tab trong vùng nhìn thấy khi thiếu chỗ; overflow nêu số tab ẩn.

Chỉ một nút **+**, mở menu “Mở nền tảng / website…” và “Thêm tài khoản…” của nền tảng hiện tại. Menu tài khoản vẫn chọn peer đúng nền tảng/không gian, thêm mục thêm tài khoản và chat nổi.

Phía phải giữ Không gian “Thường”/“Kín” có icon khóa và title đầy đủ, Tập trung khi đang chạy, Khay dạng icon kèm số khi >0, Nhắc trả lời có badge, Chuyển nhanh và menu Công cụ. Bỏ các nút riêng thêm tài khoản, chat nổi, đổi màu, cài đặt trên hàng header.

Công cụ có Tập trung, chat nổi, đổi sáng/tối, cài đặt, Tài nguyên, Sao lưu; thao tác trang hiện tại còn truy cập được khi trang phù hợp. Badge cập nhật chuyển sang nút Công cụ. Không tăng chiều cao hay thay native page bounds.

## Điều khiển

Dùng native Menu hiện có. Các API menu trả về lựa chọn UI có kiểu, chỉ sau khi menu đóng và vẫn đúng account/panel/epoch; renderer chạy helper có sẵn. Không giữ button DOM vô hình chỉ để gọi click. Menu công cụ dùng được ở Settings, Library và workspace trống; page/floating actions bị khóa khi không có trang phù hợp.

Mọi menu và action trễ bị hủy khi đổi/khóa không gian, đổi account/panel, mở editor/modal, import, account mutation hoặc quit. Không lộ tài khoản kín hoặc dựng lại native views. Không đổi account ID/partition, sleep, Focus, notification/unread, shortcut hay settings data.

## Kiểm chứng

TDD layout và Electron fixture trước wiring. Chụp 940/1280 sáng/tối, kiểm tra header vẫn 52 px; custom labels dài, pinned active, tám nền tảng, overflow khi Focus và trạng thái kín. Chọn nền tảng/tài khoản giữ native document/draft; menu +/account/tools thực thi đúng action sau dismissal; stale menu không chạy; badges và dữ liệu bị scrub qua workspace; no-op state không gây DOM mutation.

Cập nhật fixture cũ theo điểm vào menu mới, không giữ selector nút đã bỏ. Typecheck/build/full unit suite, header fixture và hồi quy native-tabs/Focus/resource/backup/floating thích hợp. Một reviewer độc lập toàn nhánh cuối; lưu source cục bộ, không push/merge/phát hành/cài app thật.
