# 0.5.3 — Chat riêng theo nền tảng

Yêu cầu mới thay thế phạm vi chat thống nhất và nghiên cứu connector: giữ Electron, mỗi nền tảng dùng trang chat chính thức, giao diện Mac tối giản.

- Thanh công cụ 64px; tab Zalo / Telegram / Messenger, bộ chọn tài khoản cùng nền tảng, nút thêm và cài đặt. Không có sidebar app trùng với sidebar trang chat.
- Chuyển tab nhớ tài khoản cuối, tái sử dụng WebContentsView, không reload. Giữ userData, partition, cookie và dữ liệu nền tảng. Bản nháp trong trang được giữ khi đổi tab/ẩn cửa sổ; sau thoát phụ thuộc nền tảng.
- Giữ tối ưu CPU và workaround Secure Input đã kiểm chứng ở 0.5.2. Không gắn connector nghiên cứu vào runtime.
- Kiểm tra unit/typecheck, fixture tab/geometry/focus/drafts, nhiều tài khoản, persistence, lifecycle, renderer/CPU và native IME. Dùng hồ sơ tạm, không gửi tin thật.
- Đóng gói 0.5.3 arm64, kiểm tra ZIP/chữ ký ad-hoc/version/inventory/runtime hash. Không thay ứng dụng đang chạy.

Trạng thái: đã triển khai, kiểm thử và đóng gói 0.5.3. Chi tiết, bằng chứng và giới hạn trong [báo cáo phát hành](../../release-0.5.3.md).
