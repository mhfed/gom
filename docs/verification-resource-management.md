# Kiểm chứng Quản lý tài nguyên

Ngày: 2026-10-30. Mã nguồn phát triển từ `08449e4` (Tập trung có hẹn giờ); chưa phát hành/cài bộ cài mới.

## Kiểm tra nguồn và giao diện

- Typecheck và build đạt; toàn bộ **269/269 unit test** đạt, không bỏ qua. Có 14 kiểm thử mới cho bộ đo, lưu/ngủ/thức và dọn DOM tài khoản mất quyền truy cập.
- `node scripts/resources-check.mjs`: **13 nhóm** đạt trên Electron thật với appData/home, trang nền tảng và dữ liệu giả. Metric lấy từ tiến trình fixture thật; không dùng số minh họa cho giao diện.
- `node scripts/native-tabs-check.mjs`: **16 kiểm tra** đạt, bảo toàn 9 trang/bản nháp native. Trạng thái không đổi gây 0 DOM mutation.
- `node scripts/focus-check.mjs`: **18 nhóm** đạt; `node scripts/floating-chat-check.mjs`: **12 nhóm** đạt khi chạy lại. Lần đầu floating có lỗi epoch unlock, nên không coi lần đầu là đạt.
- Hai hồi quy cũ chưa đạt toàn phần: `private-space-check.mjs` dừng sau 5 nhóm ở `owned private popup`; lần chạy chẩn đoán dừng sớm hơn ở unlock. `reminders-check.mjs` dừng sau 4 nhóm ở `native hide privacy barrier`. Không sửa hoặc bỏ assertion để ép đạt.
- Đối chứng bằng `git archive 08449e4`, build độc lập trong thư mục tạm và chạy cùng script: private cũng lỗi unlock khi đổi/khôi phục cửa sổ; reminders tái hiện đúng `native hide privacy barrier` (một lượt khác lỗi locator bị tách khỏi DOM); floating đạt 12 nhóm. Đối chứng cho thấy các harness native có bất ổn trước thay đổi này, nhưng chưa xác định riêng nguyên nhân timeout popup hiện tại. Không tuyên bố toàn bộ hồi quy GUI đạt. Fixture Tài nguyên mới đã kiểm tra đổi không gian, thu hồi dữ liệu/DOM/IPC kín và mở nhắc việc khi wake lỗi.
- Giao diện đã sửa theo yêu cầu trực quan hơn: tổng RAM/CPU, thanh phân bổ, bộ đếm đang chạy/ngủ/chưa mở, logo nền tảng, thanh RAM tương đối theo danh sách và nút ngủ/thức. Giữ palette/type/icon Gom hiện có. Bản sáng 940×640 và tối 1280×800 đã được xem trực tiếp; ảnh chụp sau khi CSS transition chuyển theme hoàn tất. Fixture 13 nhóm được chạy lại đạt sau thay đổi cách chụp ảnh này.
- Ảnh, JSON và log đối chứng/hồi quy: `outputs/resources-check/` (log ở `regressions/`). Số trên ảnh là số đo của fixture kiểm thử, không đại diện tài khoản hay mức dùng RAM/CPU thực tế của người dùng.

## Hành vi đã xác minh

Đo chỉ khi mở phần Tài nguyên và cửa sổ hiện; CPU mẫu đầu không giả thành 0; không đếm trùng PID dùng chung và không chia chi phí tùy ý; thiếu mẫu/PID được tái sử dụng được xử lý như số liệu chưa biết. Tổng ứng dụng có thể gồm tài nguyên nền khác nhưng không xuất PID/URL/chi tiết tài khoản của không gian khác.

Ngủ tháo đúng trang sau khi lưu phiên và marker, giữ cookie/localStorage cùng bản nháp/trang khác. Poll không tự dựng lại; lựa chọn ngủ qua restart; chọn lại tài khoản chủ động đánh thức đúng partition. Hủy hộp xác nhận, lỗi flush, lỗi ghi, chọn lại tài khoản hoặc đổi không gian trong lúc ghi đều giữ trang. Chốt đang phát âm thanh, popup, tải xuống và chat nổi đã được thử. Danh sách/snapshot/DOM không lộ tài khoản kín sau đổi/khóa không gian.

Nhắc trả lời mở tài khoản ngủ phải chờ đánh thức; khi ghi trạng thái thức thất bại, kết quả là lỗi và tài khoản vẫn ngủ. Nhắc việc/Tập trung dùng nguyên chính sách thông báo sẵn có.

## Rà soát độc lập và sửa

Một reviewer chỉ đọc tìm 4 vấn đề Important; không có Critical/Minor khác. Cả 4 có kiểm thử tái hiện thất bại trước sửa:

1. Hủy sau ghi marker rồi dựa vào ghi bù có thể để lệch trạng thái trên đĩa. Sửa thành chuẩn bị tệp tạm, xác thực lần cuối rồi rename và cập nhật trang/trạng thái đồng bộ, không có await giữa các bước cuối và không cần ghi bù.
2. Thiếu PID tài khoản nhưng còn metric khác làm subtotal thành 0 giả. Sửa subtotal thành unknown khi phần sở hữu còn thiếu mẫu.
3. Nhắc trả lời báo mở thành công trước khi wake hoàn tất. Sửa chờ activate và chuyển tiếp kết quả lỗi.
4. Phần Tài nguyên bị ẩn còn giữ hàng tài khoản đã chuyển sang không gian khác. Sửa dọn ID không còn quyền ở mỗi sync, trước kiểm tra visibility; đã kiểm tra DOM thật bằng Linkedom.

## Quyết định triển khai

- Dùng tệp `resource-sleep.json` riêng để không ghi đè cài đặt chung; chi phí là một tệp metadata nhỏ chứa ID đã chọn ngủ.
- Nút Đánh thức dựng trang nền và giữ bảng Tài nguyên; chọn tài khoản/nhắc việc mới mở trang. Đây là lựa chọn để người dùng tiếp tục so sánh số đo.
- Wake IPC trực tiếp khi thao tác ngủ còn pending bị từ chối; giao diện khóa nút đó trong lúc xử lý. Chủ động chọn tài khoản vẫn hủy ngủ cũ và đã có native regression. Không mở thêm API hủy riêng trong bản đầu.
- Chỉ quy chi phí các renderer chính/popup có chủ sở hữu chắc chắn; tiến trình khác nằm trong phần còn lại. Không khẳng định mỗi hàng là toàn bộ chi phí của một tài khoản.

## Giới hạn

Tất cả thao tác dùng fixture và dữ liệu tạm; không truy cập tài khoản thật, gửi tin hoặc tạo nhắc việc thật. Chưa kiểm thử Windows trong lượt này. Không hứa giữ bản nháp của trang bị đóng, thông báo nền tảng khi ngủ, mức giảm RAM/pin cố định hoặc CPU tư nhân của từng tài khoản.

Bộ `settings-ui-check.mjs` cũ có điều kiện cứng 6 tài khoản, đã tái hiện lỗi trên nguồn gốc trong lượt Tập trung; không dùng nó để tuyên bố kiểm chứng bản này. Phần Tài nguyên và bảng cài đặt liên quan được kiểm tra bằng fixture mới và native-tabs.

Công cụ Superdesign CLI bị auto-review từ chối do lệnh tải/thực thi gói bên ngoài. Không chạy lại hoặc lách qua công cụ khác; giao diện được xây trực tiếp bằng HTML/CSS/TypeScript hiện có, không thêm dependency hay gửi mã nguồn ra dịch vụ thiết kế.
