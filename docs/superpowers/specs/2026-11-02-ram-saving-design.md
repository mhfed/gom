# Tự ngủ tab nền sau 15 phút

Ngày: 2026-11-02.

## Mục tiêu

Giảm bộ nhớ mà các tài khoản chat Gom giữ trong các WebContentsView đang ẩn. Gom hiện giới hạn thời gian khởi động không bị giảm tải nền, nhưng các trang đã mở tiếp tục tồn tại đến khi ứng dụng thoát hoặc tài khoản bị gỡ. Bạn chọn tự ngủ tab sau 15 phút và triển khai theo từng phần.

## Hướng đã chọn

Các hướng đã cân nhắc:

- **Chỉ giới hạn bộ xử lý nền:** trang còn sống, có thể giữ thông báo, bản nháp và trạng thái giao diện; mức giải phóng bộ nhớ thấp vì WebContents vẫn giữ trang.
- **Tự ngủ WebContents rồi tạo lại khi cần — đề xuất:** sau 15 phút không được chọn, đóng WebContentsView và tái tạo bằng cùng partition lưu bền. Đây là cách phù hợp yêu cầu giảm RAM; có thời gian tải lại, tab đang ngủ không nhận thông báo nền, và bản nháp mà website chưa lưu có thể mất.
- **Đóng trang sau khi sao lưu toàn bộ nội dung giao diện:** có thể khôi phục bản nháp và vị trí chi tiết hơn, nhưng đòi hỏi đọc hoặc lưu dữ liệu nhạy cảm từ nhiều giao diện website và không có giao diện chung đáng tin cậy. Hướng này không phù hợp nền tảng Gom hiện có.

Chọn cách ngủ WebContents sau 15 phút. Người dùng đã chấp nhận chính sách tự ngủ; tab đang mở, cửa sổ chat nổi đang hoạt động và thao tác xác thực/nhập phiên đang diễn ra được giữ sống.

## Hành vi

- Đồng hồ 15 phút bắt đầu khi một tài khoản không còn là tài khoản đang dùng trong Gom. Kích hoạt lại trước hạn đặt lại bộ đếm.
- Không ngủ view của tài khoản đang được chọn trong tab nền tảng đang mở, đang ở cửa sổ chat nổi, hoặc đang được dùng bởi một thao tác bảo vệ tài khoản/phiên. Tài khoản còn view nền nhưng tab nền tảng đã đóng có thể ngủ theo chính sách này. Không lưu trạng thái đếm ngược qua lần thoát; lần khởi chạy mới bắt đầu bộ đếm khi tab trở thành nền.
- Trước khi hủy view, lưu dữ liệu session/cookie thông qua các API lưu hiện có. Không làm sạch partition, cookie, Local Storage, IndexedDB hay cache của tài khoản.
- Khi người dùng chọn lại tab, tạo view mới cùng ID tài khoản/partition và URL nền tảng, rồi chạy nhận diện đăng nhập, trạng thái kết nối, giao diện và số chưa đọc như khi mở lại app.
- Giữ tab và bộ đếm chưa đọc trong thanh công cụ. Trạng thái tab ngủ được hiển thị để người dùng biết tài khoản sẽ tải lại khi mở.
- Tab ngủ không xử lý web push hoặc notification của website. Số chưa đọc là số gần nhất Gom đã nhận và có thể cũ cho đến khi trang hoạt động lại.
- Nói rõ trong phần cài đặt rằng nội dung soạn chưa gửi có thể mất nếu website không tự lưu trước khi Gom đưa trang vào ngủ.

## Giới hạn an toàn

- Giới hạn quyền ngủ theo **account ID**, không theo provider ID: các tài khoản cùng dịch vụ có partition, view và chu kỳ độc lập.
- Chỉ ngủ view thuộc catalog hiện tại, không bị archive/xóa, thuộc không gian hiện đang mở và không có thao tác bất đồng bộ nào đang dùng. Chuyển/khóa không gian vô hiệu hóa timer cũ.
- Ngủ lỗi không được xóa/ghi lại dữ liệu đăng nhập. Nếu flush thất bại, giữ view và thử lại sau; không giả trạng thái đã ngủ.
- Nếu tạo lại view thất bại do offline hay lỗi tải, giữ account/tab, hiển thị trạng thái phục hồi hiện có và cho phép thử lại; không tự tạo lặp nhiều view.
- Giữ nguyên quyền từ chối đăng nhập, yêu cầu khóa riêng tư, chính sách điều hướng và sandbox khi tạo lại view.

## Phần cần đổi

- Thêm theo dõi trạng thái thức/ngủ và bộ đếm nền có kiểm tra workspace generation vào main process; hủy view bằng Registry trong khi vẫn giữ dữ liệu account/session.
- Thay đổi activation, layout, khôi phục startup, phát hiện tình trạng nền, flush-before-close và luồng thao tác nhập phiên để không giữ WebContents hủy hoặc tạo view trùng.
- Thêm nhãn ngủ cho tab/tài khoản dùng chung trong renderer và ghi rõ tác động tới thông báo/bản nháp trong giao diện cài đặt, tài liệu người dùng.
- Bổ sung kiểm thử thời gian ngủ, chọn lại trước/sau hạn, đổi account/workspace, account đã gỡ, private lock, detached view, flush thất bại, offline và thoát ứng dụng.

## Kiểm chứng và tiêu chí hoàn thành

- Test thời gian dùng đồng hồ giả: view vẫn hoạt động trước 15 phút; bị hủy đúng một lần sau hạn; hành động của tài khoản khác không kéo dài timer của nó.
- Test session/IDB/cookie trong partition giả còn nguyên sau khi sleep/wake; không thể đặt credential hoặc draft thật vào fixture.
- Test có nhiều view, chat nổi, account switch, private lock/unlock, archive/remove, offline, import session, ứng dụng thoát và chạy lại.
- Test Electron hồ sơ tạm xác nhận không còn view ngủ trong cây `WebContents`, tab cũ vẫn thấy, tab được đánh dấu ngủ và wake tạo đúng một view cùng session.
- Đo RAM trong cùng kịch bản fixture trước/sau bằng PID/process metrics Electron ở trạng thái ổn định; ghi số liệu cho 0, 2 và 5 view nền. Báo số thực đo, không hứa trước một mức tiết kiệm.
- Chạy suite liên quan, full unit test, typecheck và build debug. Không tạo installer/release trong giai đoạn này.

## Nguồn

- Gom đã có bộ nhận diện khởi động nền `src/main/background-throttling.ts`, Registry cho view theo account và `flushStorageData()`/`cookies.flushStore()` trước khi thoát app. Những thành phần này là nền tảng tái sử dụng; chúng chưa chứng minh rằng hủy view và tạo lại không làm mất trạng thái website.
- User chọn tự ngủ tab sau 15 phút và đồng ý thực hiện ba tính năng thành các phần nối tiếp. Thiết kế này chỉ mở đợt đầu tiên về tiết kiệm RAM; Không gian có tên và nhắc mở đúng cuộc trò chuyện được giữ lại cho các đợt tiếp sau.

Trạng thái: người dùng đã duyệt thiết kế; đã triển khai phần tiết kiệm bộ nhớ trong giai đoạn này.
