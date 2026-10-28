# Gom Kín — không gian riêng tư

## Phạm vi đã chọn

Người dùng yêu cầu tài khoản kín phải nhập mật khẩu khi mở và đã yêu cầu triển khai (“Làm đi”). Dùng mật khẩu riêng của Gom, hoạt động cục bộ trên Mac và Windows. Đây là khóa truy cập trong giao diện ứng dụng; cookie, storage và tệp phiên Chromium tiếp tục dùng cơ chế lưu trữ hiện tại của hệ điều hành, không được mã hóa lại bằng mật khẩu Gom.

## Các hướng đã cân nhắc

- Chỉ ẩn tài khoản: không đáp ứng yêu cầu mật khẩu.
- Mật khẩu riêng, xác thực và quyền truy cập do tiến trình chính quản lý: được chọn theo đề xuất trước khi triển khai.
- Kho dữ liệu phiên mã hóa riêng: cần thiết kế vòng đời phiên và khôi phục khác; không thuộc lần triển khai này.

## Hành vi

- Nút ổ khóa trên thanh công cụ và mục Không gian kín trong Cài đặt → Tài khoản mở hộp thiết lập/mở khóa.
- Mật khẩu dài 8–256 ký tự, nhập xác nhận lúc thiết lập/đổi. Đổi mật khẩu yêu cầu mật khẩu hiện tại. Không có luồng quên mật khẩu làm hiện lại các tài khoản kín.
- Sau khi mở khóa, tài khoản kín xuất hiện cùng danh sách tài khoản với nhãn riêng. Menu tài khoản cho phép đưa vào/ra khỏi không gian kín. Việc chuyển thành viên chỉ thực hiện khi đã mở khóa.
- Khóa bằng nút ổ khóa hoặc Cmd/Ctrl+Shift+L trong Gom. Tự khóa khi ẩn/thu nhỏ cửa sổ, máy ngủ hoặc hệ điều hành khóa màn hình. Khởi động mới luôn khóa. Chuyển sang ứng dụng khác không tự khóa.
- Khi khóa, giao diện về màn chào mừng, xóa các nội dung riêng tư còn nằm trong hộp thoại, tìm kiếm nhanh và thư viện. Cửa sổ phụ của tài khoản kín được ẩn, âm thanh bị tắt. Mở tài khoản sau khi mở khóa khôi phục trang và cửa sổ phụ đang giữ.
- ID, partition, trang và bản nháp trong bộ nhớ được giữ qua khóa/mở; việc giữ bản nháp sau thoát ứng dụng vẫn tùy dịch vụ.
- Tài khoản kín luôn tắt thông báo, kể cả lúc mở khóa, để tránh phát sinh lịch sử thông báo hệ điều hành. Gom cố đóng các thông báo trang đang giữ khi chuyển vào không gian kín; không cam kết xóa lịch sử thông báo đã phát trước đó.
- Đăng nhập trực tiếp cho tài khoản kín; nhập phiên Chrome chỉ áp dụng tài khoản thường trong phiên bản đầu.

## Bảo vệ

- Mật khẩu không lưu dạng rõ hoặc đi vào AppState/log. Verifier scrypt có salt ngẫu nhiên, kiểm tra theo thời gian cố định, giới hạn thử sai tăng dần và lưu qua khởi động lại.
- Main kiểm tra quyền cho mọi đường kích hoạt/đọc/sửa tài khoản và nền tảng riêng; renderer chỉ nhận snapshot đã loại tài khoản kín khi khóa, bao gồm các map trạng thái, unread, ghim và website riêng chỉ thuộc tài khoản kín.
- Menu, badge, thông báo và callback bất đồng bộ không được mở lại tài khoản sau một lần khóa mới. Kết quả xác thực cũ bị hủy nếu người dùng khóa trong lúc chờ.
- Thiếu/hỏng cấu hình mật khẩu trong khi đã có tài khoản kín không cho đặt lại để bỏ qua khóa. Khôi phục catalog không chắc chắn phải giữ tài khoản ở trạng thái kín.
- Không bảo vệ khỏi người có quyền đọc/sửa dữ liệu bằng cùng tài khoản hệ điều hành hoặc quyền quản trị. Không thay tên tiến trình hay giả làm ứng dụng khác.

## Kiểm chứng và bàn giao

Dùng unit tests cho verifier/cooldown/catalog/projection, kiểm tra renderer với dữ liệu giả, và Electron với appData/profile tạm, Keychain giả, mọi trang HTTP(S) được thay bằng fixture. Kiểm tra các đường khóa, IPC, popup, bản nháp, toàn bộ tài khoản kín và restart. Không sử dụng tài khoản thật. Bước này tạo mã nguồn và build kiểm chứng cục bộ, không cài đặt hoặc phát hành bộ cài.
