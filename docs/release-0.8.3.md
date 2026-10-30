# Gom 0.8.3 — Tập trung, tài nguyên và cấu hình

[Gom 0.8.3](https://github.com/mhfed/gom/releases/tag/v0.8.3) đã phát hành ngày **30/10/2026** cho Mac Apple Silicon và Windows x64.

Bản này bổ sung Tập trung có hẹn giờ, Quản lý tài nguyên, Sao lưu cấu hình và header gọn một hàng.

## Tập trung có hẹn giờ

Chọn **··· Công cụ → Tập trung…**, đặt **30 phút**, **1 giờ** hoặc giờ kết thúc trong 24 giờ tới. Gom hoãn thông báo mới và Nhắc trả lời; số chưa đọc vẫn cập nhật. Có tùy chọn tắt âm thanh trang, đổi thời lượng hoặc kết thúc sớm. Phiên còn hạn tiếp tục sau khi mở lại app; các quyền thông báo và trạng thái tạm dừng thủ công được giữ. [Hướng dẫn](timed-focus.md).

## Quản lý tài nguyên

Mở **··· Công cụ → Tài nguyên** để xem RAM/CPU ước tính khi đo được, sắp xếp tài khoản và cho trang ít dùng tạm ngủ. Đánh thức hoặc chọn lại tài khoản để dùng phiên đã có; lựa chọn ngủ được giữ qua lần mở lại. Khi ngủ, tài khoản ngừng cập nhật thông báo/số chưa đọc và bản nháp chưa được nền tảng lưu có thể mất. Bộ đo chỉ chạy khi bảng Tài nguyên đang hiện. [Hướng dẫn](resource-management.md).

## Sao lưu và khôi phục cấu hình

Mở **··· Công cụ → Sao lưu** để xuất cấu hình Không gian thường ra tệp, xem trước và hợp nhất cấu hình rồi khởi động lại. Gom giữ tài khoản ngoài tệp và lưu bản cấu hình bảo vệ trước khi áp dụng. Tệp không mang theo phiên đăng nhập, cookie, chat, bản nháp, Khay, Nhắc trả lời hoặc dữ liệu Không gian kín. Trên máy khác, cần đăng nhập lại. [Hướng dẫn](configuration-backup.md).

## Header gọn hơn

Nền tảng đang dùng hiện tên; các tab khác chỉ giữ logo và huy hiệu chưa đọc. Một nút **+** gom mở nền tảng/website và thêm tài khoản. Menu tài khoản có đổi tài khoản và chat nổi; **··· Công cụ** gom Tập trung, đổi sáng/tối, Cài đặt, Tài nguyên, Sao lưu và thao tác trang. Ghim/đóng tab bằng chuột phải hoặc **Shift F10**. Khay, Nhắc trả lời, nhãn **Thường/Kín** và giờ kết thúc Tập trung vẫn ở trên header. [Hướng dẫn](header-compact.md).

Các lựa chọn menu cũ bị hủy khi đổi tài khoản, panel hoặc không gian, kể cả đổi đi rồi quay lại. Giữ nguyên account ID, partition và cơ chế đăng nhập hiện có.

## Bộ cài

- Mac Apple Silicon: [DMG](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-macOS-arm64-0.8.3.dmg), [ZIP](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-macOS-arm64-0.8.3.zip), [SHA-256](https://github.com/mhfed/gom/releases/download/v0.8.3/SHA256SUMS-Gom-0.8.3-macos.txt).
- Windows x64: [Setup.exe](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom-win32-x64-0.8.3-Setup.exe), [gói cập nhật](https://github.com/mhfed/gom/releases/download/v0.8.3/Gom_win32_x64-0.8.3-full.nupkg), [RELEASES](https://github.com/mhfed/gom/releases/download/v0.8.3/RELEASES), [SHA-256](https://github.com/mhfed/gom/releases/download/v0.8.3/SHA256SUMS-Gom-0.8.3-windows.txt).

Mac ký ad-hoc, chưa notarize; Windows chưa ký Authenticode. Lưu bản nháp trước khi thoát app để nâng cấp. Dữ liệu tài khoản và partition đăng nhập tiếp tục dùng lại. [Kiểm chứng](verification-0.8.3.md).
