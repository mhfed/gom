# Tập trung có hẹn giờ

Ngày: 2026-10-30. Trạng thái: người dùng đã duyệt và yêu cầu triển khai theo thiết kế.

## Mục tiêu

Người dùng chọn chức năng Tập trung có hẹn giờ làm bước phát triển tiếp theo của Gom. Cho phép giữ yên lặng trong một khoảng thời gian, tự kết thúc và tiếp tục dùng các quyền thông báo sẵn có của từng tài khoản.

## Cách triển khai đề xuất

Mở rộng chính sách thông báo trong tiến trình chính Electron, với thời điểm kết thúc tuyệt đối được lưu trong cấu hình. Dùng chung chính sách cho thông báo nền tảng, thông báo thử và Nhắc trả lời. Bộ hẹn ở renderer không phù hợp vì cửa sổ có thể bị ẩn hoặc tải lại; dịch vụ lịch của hệ điều hành chưa cần thiết vì Gom chỉ xử lý thông báo khi app đang chạy.

## Phạm vi bản đầu

- Thêm mục Tập trung trong Cài đặt → Thông báo; chọn 30 phút, 1 giờ hoặc thời điểm kết thúc cụ thể trong 24 giờ tới.
- Có nút bắt đầu, đổi giờ kết thúc và kết thúc sớm; hiển thị trạng thái và thời điểm kết thúc rõ ràng. Có thao tác nhanh trong bảng lệnh và menu khay hệ thống.
- Tập trung chặn thông báo mới của mọi tài khoản thường và hoãn thông báo Nhắc trả lời đến khi kết thúc. Huy hiệu chưa đọc vẫn cập nhật.
- Có lựa chọn tắt âm thanh trang trong phiên Tập trung, mặc định tắt lựa chọn này để tránh làm im cuộc gọi đang diễn ra. Nếu người dùng bật, áp dụng cả trang chính, popup và chat nổi, kể cả sau khi đổi tài khoản.
- Không sửa lựa chọn Cho phép/Tắt/Hỏi của từng tài khoản. Tạm dừng thông báo thủ công là trạng thái độc lập: kết thúc Tập trung không tự bỏ tạm dừng mà người dùng đã bật.
- Lưu giờ kết thúc và lựa chọn âm thanh. Sau khi mở lại app, tiếp tục phiên còn hạn; phiên quá hạn được kết thúc. Kiểm tra lại ngay khi máy thức dậy, không tải lại trang nền tảng.
- Không gian kín tiếp tục chính sách không phát thông báo vốn có; thông tin hiển thị về Tập trung chỉ gồm thời gian và tùy chọn chung.

## Giới hạn phạm vi

Lịch giờ làm việc lặp theo ngày/tài khoản để ở bước tiếp theo, vì đây là bộ lập lịch khác với một phiên Tập trung có giờ kết thúc. Bản đầu không đổi quyền thông báo của hệ điều hành, không đóng trang hoặc tự thao tác trên hội thoại.

## Xác minh

- Kiểm thử thời điểm bắt đầu/kết thúc, đổi giờ, kết thúc sớm, dữ liệu cấu hình sai, mở lại app và máy ngủ/thức.
- Kiểm thử phối hợp với tạm dừng thủ công, quyền từng tài khoản, Nhắc trả lời và không gian kín.
- Fixture Electron với dữ liệu tạm: thao tác giao diện, menu, thông báo bị chặn, âm thanh khi chuyển tài khoản/popup/chat nổi và bảo toàn phiên/bản nháp.
- Typecheck, unit tests, build và các kiểm tra hồi quy phù hợp. Không dùng tài khoản thật để gửi tin hoặc tạo nhắc việc thật.

## Các lựa chọn do người triển khai đề xuất

Giới hạn 24 giờ; mặc định không tắt âm thanh; tách tạm dừng thủ công khỏi Tập trung; lịch lặp nằm ngoài bản đầu. Người dùng đã duyệt các lựa chọn này cùng thiết kế.
