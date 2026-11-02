# Mở lại cuộc trò chuyện từ Nhắc trả lời

## Mục tiêu

Khi tạo nhắc từ một tài khoản đang có cuộc trò chuyện mở, Gom lưu URL nội bộ hiện tại nếu nó khác trang vào mặc định. Nút mở nhắc sẽ mở URL đó sau khi kiểm tra lại quyền điều hướng; nhắc cũ và trang không có URL riêng vẫn mở tài khoản như hiện nay.

## Các cách đã cân nhắc

- Đọc DOM hoặc nội dung chat để suy ra cuộc trò chuyện: không chọn vì phải đọc dữ liệu hội thoại và phụ thuộc DOM riêng từng nền tảng.
- Lưu URL nội bộ hiện tại của view tài khoản: chọn vì không đọc tin nhắn, dùng lại điều hướng an toàn hiện có và hoạt động khi nền tảng thể hiện cuộc trò chuyện trong URL.
- Yêu cầu người dùng dán liên kết thủ công: không chọn làm luồng chính vì thêm thao tác cho mọi nhắc; vẫn có thể xem xét nếu cần hỗ trợ nền tảng dùng liên kết ngoài giao diện.

## Hành vi

- Lúc lưu nhắc, tiến trình chính đọc URL của view thuộc tài khoản đang mở và đang được chọn. Chỉ lưu URL http(s) nội bộ được navigationPolicy chấp nhận, không có credential, tối đa 4096 ký tự, và khác URL vào mặc định của nền tảng. Nếu tài khoản nhắc không phải tài khoản đang mở hoặc không có URL riêng, nhắc sẽ mở tài khoản để người dùng chọn lại.
- URL được lưu bên trong kho nhắc đã mã hóa. Snapshot gửi renderer chỉ cho biết có liên kết hay không; không gửi URL hoặc ID cuộc trò chuyện ra giao diện.
- Khi mở nhắc, nếu liên kết còn hợp lệ thì nạp URL đó trong cùng tài khoản/partition. Nếu view đang ngủ, dùng URL nhắc ngay lúc tạo view để tránh nạp trang chủ trước.
- Nếu URL không biểu diễn cuộc trò chuyện, không còn được tin cậy, hoặc nền tảng giữ lựa chọn cuộc trò chuyện chỉ trong trạng thái JavaScript, Gom không đọc DOM để đoán. Nhắc mở tài khoản và hiện thông báo để người dùng chọn lại.
- Nhắc cũ không có URL tiếp tục hoạt động. URL bị đổi domain, không còn được tin cậy hoặc không hợp lệ bị bỏ; không điều hướng ra ngoài.

## Phạm vi và giới hạn

- Không đọc, trích xuất, lưu hoặc gửi nội dung tin nhắn. Không tự trả lời.
- Hỗ trợ mở chính xác khi URL hiện tại của nền tảng chứa route hội thoại. Không hứa deep link cho nền tảng chỉ giữ cuộc trò chuyện trong trạng thái trang nội bộ.
- Không đổi giới hạn, lịch nhắc, phân vùng riêng tư hoặc chính sách thông báo.

## Trạng thái

Người dùng đã chọn tính năng “Nhắc trả lời đúng cuộc trò chuyện” và yêu cầu tiếp tục triển khai lần lượt; các quyết định triển khai còn lại là mặc định của người thực hiện.
