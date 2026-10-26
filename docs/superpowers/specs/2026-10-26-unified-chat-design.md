> Phạm vi chat thống nhất đã dừng theo yêu cầu mới “chat riêng từng nền tảng”. Giữ phong cách Mac tối giản; áp dụng thanh tab và trang chat chính thức theo [kế hoạch 0.5.3](../plans/2026-10-26-platform-tabs.md). Nội dung bên dưới là lịch sử thiết kế.

# Thiết kế Tin Nhan: hội thoại thống nhất

Trạng thái: **đã duyệt thiết kế giao diện ngày 2026-10-26**. Sau khi xem các hướng và yêu cầu bổ sung tab nền tảng, người dùng xác nhận “Chốt nhé” với bản **Mac tối giản** đang mở tại `/directions/native.html`. Đây là chuẩn thị giác và tương tác cho bước triển khai; giao diện mới chưa được tích hợp vào app. Phạm vi kết nối tin nhắn thật vẫn cần được xác minh như mô tả bên dưới. Lỗi EVKey đã được sửa riêng trong bản cài thử 0.5.2.

## Công nghệ đã thống nhất

Ngày 2026-10-26, sau khi trao đổi về Electron, Tauri và SwiftUI/AppKit, người dùng chọn **giữ Electron cho giai đoạn đầu**: “thôi đầu tiên để electron đã”. Thiết kế Mac tối giản được triển khai trên nền công nghệ hiện có. Giữ các yêu cầu bảo toàn phiên đăng nhập/bản nháp và ưu tiên CPU nền, RAM. Việc xác minh kết nối dữ liệu cho giao diện chat thống nhất vẫn là phần riêng của kế hoạch triển khai.

## Phạm vi triển khai đã được xác nhận

Ngày 2026-10-26, người dùng yêu cầu tiếp tục xác minh và xây kết nối dữ liệu thật trước khi build giao diện thống nhất. Người dùng cũng chấp nhận nghiên cứu kết nối thử nghiệm qua trang web đã đăng nhập cho **Zalo/Messenger cá nhân**, hiểu rằng kết nối có thể hỏng khi nền tảng đổi giao diện, và chỉ đưa vào bản cài sau khi kiểm chứng. Giới hạn không thu thập DOM trong lượt thiết kế bên dưới đã kết thúc cùng giai đoạn thiết kế; việc nghiên cứu DOM hiện được cho phép. Quyết định này không biến API OA/Page thành API tài khoản cá nhân, không cho phép coi dữ liệu minh họa là dữ liệu thật, và không yêu cầu gửi tin nhắn thật để kiểm tra.

Telegram ưu tiên TDLib chính thức; phiên TDLib tách khỏi phiên Web K hiện có. Nghiên cứu Zalo/Messenger bắt đầu bằng quan sát DOM đọc được trên trang chính thức, không lấy cookie/token hay khóa E2EE làm API. Mọi thao tác gửi thật cần người dùng tự thực hiện hoặc chỉ định rõ người nhận và nội dung.

## Mục tiêu sản phẩm

Người dùng muốn Tin Nhan có cảm giác là một ứng dụng nhắn tin, giảm cảm giác nhiều trang web được đặt trong một cửa sổ. Đề xuất dùng một danh sách hội thoại và vùng đọc/soạn tin nhất quán giữa các tài khoản. Giữ yêu cầu trước đó: bảo toàn phiên đăng nhập, bản nháp, ưu tiên CPU nền và RAM.

Bản đã duyệt được lưu riêng tại `outputs/unified-chat-design/approved/index.html`, ảnh `outputs/unified-chat-design/approved/preview.png`. Bản làm việc: `outputs/unified-chat-design/directions/native.html`. Bản `outputs/unified-chat-design/index.html` cũ được thay thế về định hướng thiết kế. Tên, hội thoại, trạng thái và số đếm đều là dữ liệu minh họa. Prototype chỉ giữ bản nháp trong bộ nhớ của trang, không đọc tài khoản, kết nối dịch vụ hoặc gửi tin thật.

## Các hướng đã cân nhắc

1. **Tinh gọn khung hiện tại:** giảm thanh trên, bỏ chữ lặp và gom nút trình duyệt vào menu. Ít thay đổi, giữ nguyên các trang chính thức, nhưng không thống nhất được danh sách hội thoại hay trình soạn tin. Người dùng không chọn hướng này cho lượt thiết kế.
2. **Thiết kế chat thống nhất:** giao diện chung cho danh sách, hội thoại và soạn tin; dữ liệu qua lớp tích hợp riêng cho từng nền tảng. Người dùng chọn xem thiết kế trước. Việc chọn này chưa phải phê duyệt thay thế các trang chính thức hoặc chuyển phiên sang giao thức mới.

Trong lượt chọn phong cách, người dùng loại bỏ Liquid Glass và chọn **A — Mac tối giản** thay cho **B — Không gian riêng** và **C — Focus**. Sau đó yêu cầu thêm tab Zalo/Telegram và duyệt bản đã có đủ Tất cả/Zalo/Telegram/Messenger. Bố cục hai cột và hàng tab này là quyết định của người dùng, không phải giả định của người triển khai.

## Bố cục đã duyệt

- Hai cột liền mạch: hộp thư rộng khoảng 318px bên trái và vùng trò chuyện linh hoạt bên phải. Không có thanh tài khoản thứ ba hoặc các khung kính nổi.
- Tab nền tảng **Tất cả / Zalo / Telegram / Messenger** nằm phía trên ô tìm kiếm. Tab đang chọn có nền trắng trên thanh xám nhạt. Nhớ cuộc trò chuyện gần nhất của từng tab.
- Bộ chọn tài khoản nằm dưới tiêu đề Tin nhắn, tách biệt với tab nền tảng. Trong từng nền tảng có thể chọn tất cả hoặc tài khoản Cá nhân/Công việc; trong tab Tất cả, nhãn tài khoản kèm tên nền tảng.
- Cột hội thoại: tìm kiếm, lọc tất cả/chưa đọc/đã ghim, người nhận, tin gần nhất hoặc bản nháp và nhãn tài khoản nguồn. Tên trùng giữa hai nền tảng vẫn là hai hội thoại riêng. Tìm kiếm và bộ lọc trạng thái tiếp tục áp dụng khi đổi tab; nếu không có kết quả, hiển thị trạng thái rỗng và hành động xóa bộ lọc.
- Vùng trò chuyện: tiêu đề người nhận, nền tảng và tài khoản đang gửi; lịch sử có thời gian, vùng soạn tin chung. Tài khoản nguồn luôn nhìn thấy trước khi gửi.
- Khi chưa kết nối: một trạng thái riêng với hành động đến luồng đăng nhập chính thức; không dựng lại form mật khẩu của Facebook/Zalo/Telegram trong giao diện Tin Nhan.
- Chuyển hội thoại giữ bản nháp riêng theo cặp tài khoản + ID hội thoại. Không chuyển nội dung đang soạn sang một tài khoản khác.

Thiết kế thị giác đã duyệt: nền trắng/xám trung tính, chữ hệ thống macOS, đường phân chia mảnh; dòng hội thoại đang chọn xanh lam, bubble gửi xanh rất nhạt, avatar tròn. Không thêm hoạt ảnh chạy liên tục hoặc hiệu ứng blur. Đã kiểm tra prototype ở 1280×760 và 1024×720, thao tác tab bằng bàn phím và trong khung preview. Giữ mật độ thông tin và bố cục của bản đã duyệt khi triển khai.

## Ranh giới giữa thiết kế và sản phẩm thật

Mã hiện tại chỉ quản lý các `WebContentsView` bền vững, trạng thái đăng nhập, số chưa đọc và màu nền. Nó chưa có mô hình hội thoại/tin nhắn chung. Vì vậy CSS của shell không đủ để biến vùng chat thành giao diện trong prototype.

Telegram cung cấp [TDLib](https://core.telegram.org/tdlib) để xây client riêng. Tài liệu [Zalo OA OpenAPI](https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195) mô tả tài khoản Official Account doanh nghiệp. [Mẫu Messenger chính thức của Meta](https://github.com/fbsamples/messenger-platform-samples/tree/main/handover_protocol) dùng Facebook Page và Page access token. Các nguồn này chưa chứng minh có API công khai tương đương để đọc/gửi toàn bộ hội thoại Zalo và Messenger cá nhân của người dùng.

Do đó, tính khả thi của kết nối tài khoản cá nhân cần được xác minh riêng trước khi hứa triển khai đủ ba nền tảng. Không tự dùng thư viện giao thức không chính thức, thu thập lịch sử qua DOM, tạo server trung gian hoặc di chuyển token trong lượt thiết kế này.

## Điều kiện trước khi triển khai

1. **Đã hoàn thành:** người dùng duyệt hướng Mac tối giản cùng tab nền tảng, bộ chọn tài khoản và vùng soạn tin ngày 2026-10-26.
2. Chọn phạm vi tích hợp cho từng loại tài khoản dựa trên API thực sự có thể dùng. Giao diện phải phản ánh khả năng thật của từng kết nối; chức năng chưa hỗ trợ không được giả vờ thành công.
3. Lập kế hoạch xác thực riêng cho kết nối mới. Không giả định cookie phiên web có thể dùng trực tiếp cho TDLib hoặc Page/OA API, và không thay thế/xóa dữ liệu phiên web hiện có.
4. Xác định lưu bản nháp bền vững, khóa nhận diện hội thoại, cập nhật theo sự kiện, gửi lại không trùng, trạng thái gửi/lỗi và bảo vệ nội dung tin nhắn.
5. Kiểm tra gõ tiếng Việt thực, chuyển tài khoản khi đang soạn, mất mạng, ẩn/hiện, nhiều tài khoản, và đo CPU/RAM trước khi đóng gói giao diện mới.

## Tiêu chí xem prototype

Chuyển hội thoại, lọc tài khoản và tìm kiếm phải có tác dụng trong dữ liệu mẫu. Bản nháp phải giữ khi chuyển đi rồi quay lại. Hành động gửi phải nói rõ là minh họa; không tạo yêu cầu mạng. Các màn hình kết nối và giới hạn tích hợp phải phân biệt rõ với dữ liệu thật. Prototype không được đưa vào gói cài đặt của bản sửa EVKey.
