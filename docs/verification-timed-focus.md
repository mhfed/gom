# Kiểm chứng Tập trung có hẹn giờ

Ngày: 2026-10-30. Thay đổi mã nguồn trên nhánh `codex/timed-focus`, chưa phát hành bộ cài mới.

## Kết quả

- `npm run typecheck`: đạt.
- `npm test`: **255/255** đạt, không bỏ qua; gồm 7 kiểm thử mới cho hẹn giờ, dữ liệu không hợp lệ, callback cũ, đổi đồng hồ, khôi phục và chính sách thông báo.
- `npm run build`: đạt. Prettier và `git diff --check` đạt.
- `node scripts/focus-check.mjs`: **18 nhóm** đạt trên Electron thật, với appData/home, trang nền tảng, dữ liệu nhắc việc và ranh giới thông báo/mã hóa hệ điều hành giả lập.
- `node scripts/private-space-check.mjs`: **17 kiểm tra** đạt.
- `node scripts/floating-chat-check.mjs`: **12 nhóm** đạt.
- `node scripts/native-tabs-check.mjs`: **16 kiểm tra** đạt; bảo toàn 9 trang/bản nháp native. Kiểm tra này bắt được và xác minh sửa việc render Tập trung ghi DOM khi trạng thái không đổi.
- `node scripts/reminders-check.mjs`: **15 nhóm** đạt khi chạy lại nguyên trạng. Lần đầu hết thời gian tại bước chờ sự kiện native `hide`; không sửa mã sản phẩm hoặc harness giữa hai lần chạy.

## Những hành vi đã xác minh

Chặn quyền thông báo khi Tập trung mà không thay đổi quyền từng tài khoản; tạm dừng thủ công độc lập; từ chối IPC không hợp lệ và giữ phiên cũ; tắt/bật âm thanh khi đổi tài khoản, popup mới, chat nổi và đổi không gian; kết thúc lúc cửa sổ ẩn hoặc khi máy thức dậy; khôi phục phiên còn hạn và bỏ phiên quá hạn sau restart; không tải lại trang hoặc làm mất bản nháp do thay đổi Tập trung; từ chối grant từ hộp quyền mở trước phiên; hoãn nhắc việc đến hạn và phát một lần sau khi kết thúc.

Giao diện được kiểm tra chọn 30 phút/1 giờ/giờ tùy chọn, đổi giờ, kết thúc sớm, bảo toàn giá trị đang nhập khi trạng thái khác đổi, biểu mẫu mở qua đêm, bàn phím, bảng lệnh và menu khay. Ảnh giao diện sáng 940×640 và tối 1280×800 đã được xem trực tiếp. Bằng chứng fixture cục bộ ở `outputs/focus-check/verification.json` và ảnh cùng thư mục; chỉ chứa dữ liệu giả.

## Rà soát độc lập

Một reviewer chỉ đọc phát hiện giới hạn `min/max` của giờ tùy chọn bị cũ khi biểu mẫu mở qua đêm. Kiểm thử native mới mô phỏng đồng hồ tiến 26 giờ đã thất bại trước sửa và đạt sau sửa. Bỏ giới hạn HTML bị cũ, giữ kiểm tra theo đồng hồ hiện tại khi submit và xác thực trong main. Reviewer không phát hiện vấn đề Critical hoặc Minor khác.

## Bộ kiểm tra cũ chưa dùng được

`scripts/settings-ui-check.mjs` hết thời gian ở dòng 355 trên cả thay đổi mới và bản sao **HEAD gốc `2a30650`** được build độc lập trong thư mục tạm. Harness còn chờ đúng 6 tài khoản và mọi nền tảng đều `authenticated`, trong khi catalog mặc định đã có 8 tài khoản trước khi harness thêm 3 tài khoản. Không thay đổi harness cũ trong tính năng này. Giao diện Tập trung được kiểm chứng riêng bằng fixture hiện tại nêu trên.

## Giới hạn

Không dùng tài khoản thật, không gửi tin và không tạo nhắc việc thật. Chưa kiểm chứng banner/quyền hệ điều hành hoặc thông báo trên từng dịch vụ thật, chưa chạy Windows trong lượt này. Không đổi chế độ Tập trung của hệ điều hành. Chưa đóng gói, cài app hoặc tạo release; bộ cài 0.8.2 hiện có chưa chứa tính năng.
