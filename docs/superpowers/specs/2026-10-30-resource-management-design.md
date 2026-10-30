# Quản lý tài nguyên

Ngày: 2026-10-30. Trạng thái: người dùng đã duyệt và yêu cầu triển khai theo thiết kế.

## Mục tiêu và hiện trạng

Người dùng chọn Quản lý tài nguyên làm chức năng tiếp theo sau Tập trung có hẹn giờ. Đề xuất hiển thị mức dùng RAM/CPU và cho phép chủ động cho tài khoản ít dùng tạm ngủ. Giữ Electron, phiên đăng nhập, chính sách không gian kín và các chức năng hiện có.

Gom hiện giữ các trang tài khoản dựng sẵn để nhận thông báo. Background throttling đã có nhưng không giải phóng phần lớn bộ nhớ trang. Mã đã có registry theo tài khoản, partition bền vững, flush storage/cookie, quy trình gỡ trang và epoch hủy kết quả cũ. Nhập phiên, popup, chat nổi, hồi phục trang lỗi và Nhắc trả lời cần phối hợp với trạng thái ngủ mới.

## Hai hướng và đề xuất

1. Chỉ bảng theo dõi: ít tác động vòng đời trang, giúp biết nơi dùng nhiều tài nguyên, chưa có thao tác giải phóng trang.
2. Bảng theo dõi và ngủ thủ công: cung cấp cả quan sát và kiểm soát, cần xác nhận trước khi đóng trang và kiểm thử ngủ/thức. Người dùng đã chọn và duyệt hướng này.

Ngủ tự động theo thời gian không thuộc bản đầu: không thể bảo đảm mọi website báo đúng bản nháp/cuộc gọi đang diễn ra. Không dùng kill tiến trình vì một tiến trình có thể phục vụ nhiều nội dung.

## Quan sát tài nguyên

- Thêm phần Tài nguyên trong Cài đặt, có lối mở từ bảng lệnh.
- Hiển thị tổng RAM/CPU của Gom, phần trang tài khoản và phần dùng chung của ứng dụng; danh sách tài khoản trong không gian hiện tại, trạng thái đang chạy/chưa mở/đang ngủ, RAM và CPU khi đo được. Có sắp xếp theo RAM, CPU hoặc tên.
- Lấy mẫu tập trung trong main khoảng 4 giây một lần khi phần Tài nguyên đang mở và cửa sổ chính đang hiện; dừng khi rời phần này, ẩn/thu nhỏ cửa sổ hoặc máy ngủ. Khi mở lại lấy mẫu mới; không đọc DOM hoặc nội dung chat để đo.
- Dùng API Electron đang cài đặt: app.getAppMetrics và ánh xạ tiến trình của các WebContents thuộc tài khoản. Mẫu CPU đầu tiên chưa đủ khoảng đo hiển thị đang đo; dữ liệu thiếu/hết hạn hiển thị dấu —, không biến thành số 0.
- Số RAM là working set, hiển thị là ước tính. Cộng mỗi tiến trình một lần; RAM dùng chung giữa các tiến trình vẫn có thể trùng ở mức hệ điều hành. Không hứa mức tiết kiệm RAM hoặc pin cố định.
- RAM/CPU theo tài khoản gồm các tiến trình trang/popup có thể quy chủ sở hữu chắc chắn. Tiến trình dùng chung hoặc không quy được gom về phần dùng chung, không chia tùy ý hay cộng lặp vào nhiều tài khoản. Không khẳng định đây là toàn bộ chi phí của một tài khoản.
- Tổng Gom là số tổng hợp toàn ứng dụng, có thể gồm tài nguyên của không gian khác; không trả tên, ID, URL hoặc chi tiết tiến trình của tài khoản thuộc không gian khác. Khi đổi/khóa không gian, xóa dữ liệu hàng cũ và hủy kết quả đo đến muộn. Không xuất PID, đường dẫn hoặc lịch sử tài nguyên qua bridge.

## Tạm ngủ thủ công

- Mỗi tài khoản đang chạy có nút Tạm ngủ. Hiển thị xác nhận rằng trang sẽ đóng, thông báo nền tảng/số chưa đọc ngừng cập nhật và bản nháp chưa được nền tảng lưu có thể mất. Gom không đọc/thu thập bản nháp để tự sao lưu.
- Khi tạm ngủ, ghi dữ liệu phiên bằng API hiện có rồi tháo/đóng đúng trang của tài khoản đó, dừng khảo sát và lịch tự phục hồi của trang. Không xóa cookie, localStorage, IndexedDB, tài khoản hoặc tab của tài khoản khác.
- Nếu tài khoản đang là trang chính được chọn, chuyển sang phần Tài nguyên; không lập tức tạo lại trang vì vẫn giữ active ID cũ. Nếu chưa có trang thì trạng thái là Chưa mở và không thực hiện thao tác ngủ giả.
- Chặn ngủ trong lúc nhập phiên/thay đổi tài khoản/thoát app hoặc khi tài khoản có chat nổi, popup, lượt tải xuống chưa xong hay đang phát âm thanh. Người dùng cần xử lý các hoạt động đó trước. Các chốt này không được mô tả là phát hiện được mọi cuộc gọi; xác nhận đóng trang vẫn cần thiết.
- Kiểm tra lại quyền truy cập và trạng thái hoạt động sau hộp xác nhận và sau thao tác lưu bất đồng bộ. Khóa/đổi không gian hoặc thao tác mới phải thắng thao tác cũ, không đóng trang tài khoản khác hay làm lộ thông tin kín.
- Tạm ngủ giữ lựa chọn qua khởi động lại, để Gom không tự dựng lại các tài khoản đã cho ngủ. Không thay đổi lựa chọn thông báo hoặc Tập trung. Nếu không lưu được lựa chọn thì báo lỗi và giữ trang đang chạy; không báo thành công giả.

## Đánh thức

- Nút Đánh thức hoặc chủ động chọn tài khoản sẽ bỏ trạng thái ngủ và tạo lại trang bằng đúng partition đăng nhập đã có. Có thể cần đăng nhập lại nếu nền tảng đã làm hết hạn phiên.
- Mở về địa chỉ vào nền tảng đã cấu hình. Không hứa khôi phục nguyên hội thoại, vị trí cuộn hoặc bản nháp trong bộ nhớ của trang cũ; không lưu URL tùy ý có thể chứa thông tin xác thực.
- Thao tác chuyển tab thông thường của các tài khoản còn chạy tiếp tục tái sử dụng trang như hiện tại.
- Nhắc trả lời của Gom vẫn có thể phát theo chính sách hiện có khi tài khoản ngủ, vì chạy trong main. Bấm mở từ nhắc việc là hành động chủ động đánh thức tài khoản. Không có thông báo nền tảng/số chưa đọc cập nhật trong thời gian ngủ.
- Tài khoản đã gỡ không tự đánh thức; tài khoản kín chỉ có thể được đánh thức trong không gian kín đã mở khóa. Tự mở nền lúc khởi động, retry lỗi, refresh theme và lấy mẫu tài nguyên không được đánh thức tài khoản.

## Phạm vi ngoài bản đầu

Không ngủ tự động, không kill tiến trình, không tự sửa hệ thống hoặc giới hạn RAM cứng, không biểu đồ lịch sử/telemetry, không đồng bộ dữ liệu lên server. Không đóng gói/cài/phát hành trừ khi người dùng yêu cầu tiếp.

## Xác minh

- Unit tests cho ánh xạ PID dùng chung, PID được tái sử dụng, mẫu CPU đầu/mất mẫu, không cộng trùng, số liệu lỗi, chuẩn hóa trạng thái ngủ và chu kỳ bắt đầu/dừng bộ đo.
- Fixture Electron với appData/home và trang giả: ngủ/thức đúng tài khoản, giữ partition/cookie/storage và tài khoản khác, không tự tạo lại qua poll/recovery/khởi động, bản nháp trang khác còn nguyên.
- Kiểm tra hủy sau đổi/khóa không gian; thao tác đến muộn; lỗi lưu cấu hình/phiên; chat nổi/popup/âm thanh/tải xuống; Nhắc trả lời và Tập trung; phần Tài nguyên không tự gây polling khi đã đóng.
- Kiểm tra bố cục 940px/1280px, sáng/tối, bàn phím, typecheck, toàn bộ unit tests và các hồi quy native liên quan.
- Rà soát độc lập và ghi đúng giới hạn đo; không sử dụng tài khoản thật hoặc gửi tin thật để thử.

## Các quyết định đang đề xuất

Ngủ thủ công; nhớ lựa chọn sau restart; lấy mẫu 4 giây chỉ khi mở phần Tài nguyên; xác nhận trước khi đóng trang; không tự khôi phục bản nháp; không ngủ tự động. Người dùng đã duyệt các quyết định này.

Chi tiết chia module, thuật toán quy chủ sở hữu tiến trình, cấu trúc trạng thái và cách phối hợp các hàng đợi lưu để người triển khai quyết định theo hợp đồng trên. Việc không đo được số theo tài khoản phải được biểu thị rõ thay vì suy đoán.
