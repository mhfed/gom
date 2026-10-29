# Gom 0.8.1 — Khay trung chuyển và chat nổi gọn hơn

[Gom 0.8.1](https://github.com/mhfed/gom/releases/tag/v0.8.1) đã phát hành ngày **29/10/2026** cho Mac Apple Silicon và Windows x64. Bộ cài, ASAR đóng gói và checksum đã được kiểm chứng; xem [kết quả kiểm chứng](verification-0.8.1.md).

## Khay trung chuyển

- Mở **Khay** để giữ chữ, liên kết, ảnh và bản sao tệp khi chuyển giữa nền tảng hoặc tài khoản. Nội dung lưu trên máy, được mã hóa bằng khóa do tài khoản hệ điều hành bảo vệ và còn sau khi thoát, mở lại Gom.
- Thêm chữ, bấm **Lấy từ clipboard**, **Chọn tệp…**, hoặc lưu đoạn chọn/liên kết từ menu chuột phải. Gom chỉ đọc clipboard khi bạn chủ động bấm nút.
- Tìm kiếm, lọc loại, ghim, xóa từng món hoặc **Dọn mục chưa ghim** sau khi xác nhận. Chữ/link/ảnh dùng **Sao chép**; tệp dùng **Lưu bản sao…**, rồi đính kèm trong nền tảng. Bạn tự chọn người nhận và bấm gửi.
- Mỗi không gian tối đa **100 món / 250 MiB**; mỗi tệp/ảnh tối đa **50 MiB**, mỗi đoạn chữ tối đa **64 KiB**. Chọn tối đa 10 tệp mỗi lần. Ảnh PNG/JPEG để xem và sao chép tối đa 16 triệu điểm ảnh.
- Không gian thường và kín có khay riêng. Khóa hoặc đổi không gian đóng khay, xóa nội dung đang hiển thị và hủy thao tác chưa hoàn tất của không gian cũ. Nội dung đã sao chép ra clipboard hoặc lưu ra ngoài vẫn ở ngoài Gom.

Xem [cách dùng Khay](transfer-shelf.md). Khay giữ bản sao độc lập; xóa món không xóa tệp gốc hoặc bản sao đã lưu ra ngoài. Nếu kho hoặc khóa hệ điều hành chưa đọc được, Gom báo lỗi và giữ dữ liệu hiện có.

## Chat nổi

- Mỗi lần tách mới, trang được tải lại đúng một lần sau khi áp dụng kích thước popup để nền tảng khởi tạo bố cục theo khung nhỏ. Phiên đăng nhập và partition giữ nguyên. Bản nháp chưa lưu có thể mất trong lần tải lại ban đầu tùy nền tảng; nên lưu hoặc sao chép trước khi tách.
- Thu/mở bong bóng, mở lại popup đang tồn tại và đưa tab về Gom không tải lại trang. Bản nháp gõ sau khi popup đã tải được giữ qua thu/mở trong cùng lần chạy.
- Bong bóng còn **36 px**, bằng 60% đường kính trước; logo 26 px. Cửa sổ native 48×48 px giữ khoảng đệm cho bóng và thao tác kéo/bám góc.

Việc từng nền tảng chọn giao diện mobile còn phụ thuộc cách website xử lý viewport. Xem [hướng dẫn Chat nổi](floating-chat.md). Quy tắc khóa Không gian kín và thu hồi chat nổi tiếp tục áp dụng.

## Bộ cài

- macOS Apple Silicon: [Gom-macOS-arm64-0.8.1.dmg](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-macOS-arm64-0.8.1.dmg), [Gom-macOS-arm64-0.8.1.zip](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-macOS-arm64-0.8.1.zip) và [SHA256SUMS-Gom-0.8.1-macos.txt](https://github.com/mhfed/gom/releases/download/v0.8.1/SHA256SUMS-Gom-0.8.1-macos.txt).
- Windows x64: [Gom-win32-x64-0.8.1-Setup.exe](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom-win32-x64-0.8.1-Setup.exe), [Gom_win32_x64-0.8.1-full.nupkg](https://github.com/mhfed/gom/releases/download/v0.8.1/Gom_win32_x64-0.8.1-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.1/RELEASES) và [SHA256SUMS-Gom-0.8.1-windows.txt](https://github.com/mhfed/gom/releases/download/v0.8.1/SHA256SUMS-Gom-0.8.1-windows.txt).

Bản Mac ký ad-hoc, chưa notarize; cập nhật qua DMG tải thủ công. Bản Windows chưa ký Authenticode và dùng Squirrel để cập nhật trong app. Các cảnh báo cài đặt của hệ điều hành vẫn có thể xuất hiện.

Dữ liệu tài khoản, mật khẩu Không gian kín và partition đăng nhập được dùng lại khi nâng cấp. Mật khẩu Không gian kín khóa truy cập qua giao diện, không mã hóa lại dữ liệu phiên trên đĩa; kho Khay có cơ chế mã hóa riêng. Lưu bản nháp quan trọng trước khi thoát app để cập nhật.
