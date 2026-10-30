# Sao lưu và khôi phục cấu hình

Có từ Gom 0.8.3.

## Xuất cấu hình

1. Chuyển sang **Không gian thường**, vào **Cài đặt → Sao lưu**. Bảng lệnh `⌘/Ctrl K` cũng có mục **Sao lưu và khôi phục cấu hình**.
2. Bấm **Xuất cấu hình**, chọn nơi lưu tệp `.gom-config.json`.
3. Tệp chứa tên/avatar/thứ tự và trạng thái lưu trữ tài khoản thường, nền tảng tự thêm, logo, theme, sidebar, tab/ghim và tùy chọn thông báo/phím tắt/kiểm tra cập nhật.

Đây là tệp văn bản thường, có tên tài khoản và URL website bạn cấu hình; hãy giữ ở nơi tin tưởng. Không gian kín và mật khẩu khóa, cookie/phiên đăng nhập, nội dung chat, bản nháp, Khay và Nhắc trả lời không nằm trong tệp. Phiên Tập trung đang chạy, lựa chọn ngủ tài khoản, vị trí cửa sổ và tùy chọn chạy cùng hệ điều hành cũng không được chuyển sang máy khác.

## Khôi phục

1. Bấm **Chọn tệp khôi phục…**, chọn một tệp cấu hình Gom version 1, tối đa **8 MiB**.
2. Xem ngày tạo, số tài khoản mới/cập nhật, nền tảng và logo. Mở **Tài khoản và địa chỉ trong tệp** để kiểm tra chi tiết. Bấm **Hủy** để giữ nguyên cấu hình.
3. Lưu các bản nháp chưa gửi. Bấm **Khôi phục và khởi động lại**, rồi xác nhận. Gom lưu bản cấu hình hiện tại trước, thoát bình thường và mở lại để áp dụng.

Tài khoản đã có nhưng không nằm trong tệp được giữ. ID trùng chỉ cập nhật tên/avatar/trạng thái/thứ tự khi vẫn thuộc cùng nền tảng và là tài khoản thường. Không gán ID kín thành thường hoặc đổi URL nền tảng hiện có; khi xung đột, cả lượt nhập được từ chối. Bản sao có thể chứa toàn bộ tài khoản thường đã lưu trữ hoặc danh sách trống; sau hợp nhất, Gom vẫn cần ít nhất một tài khoản chưa lưu trữ trên máy.

Trên máy hiện tại, các account ID/partition còn dùng phiên đã có. Trên máy mới, tệp chỉ dựng danh sách tài khoản và bạn cần đăng nhập lại. Khôi phục không sao chép nội dung hay phiên giữa tài khoản. Các trang được tải lại sau restart, nên bản nháp chưa được website lưu có thể mất.

Tab/ghim và logo của các nền tảng trong tệp được đưa về cấu hình đã lưu, kể cả logo mặc định. Tài khoản/nền tảng ngoài phạm vi nhập và bố trí riêng của Không gian kín được giữ. Tùy chọn dùng chung và logo nền tảng dùng chung áp dụng toàn app. Phiên Tập trung hiện tại và trạng thái ngủ trên máy vẫn theo dữ liệu hiện có.

## Bản bảo vệ và xử lý lỗi

Mỗi lần xác nhận khôi phục có một tệp **before-restore-…gom-config.json** trong thư mục sao lưu cục bộ. Bấm **Mở thư mục sao lưu** để tìm, rồi chọn tệp đó qua luồng khôi phục nếu muốn quay lại. Tệp này chỉ sao lưu cấu hình thường như tệp xuất, không sao lưu phiên/bản nháp.

Không ghi được bản bảo vệ/pending, tệp sai định dạng/quá lớn hoặc không gian/cấu hình thay đổi sau xem trước: Gom báo lỗi và giữ cấu hình hiện tại. Chọn tệp để xem trước lại. Khi có thao tác tài khoản, nhập phiên, ngủ/thức hoặc cập nhật đang chạy, chờ hoàn tất trước.

Nếu app dừng giữa lúc áp dụng, lần mở tiếp theo phục hồi giao dịch trước khi đọc tài khoản. Không thể hoàn tất rollback vì quyền ghi/dung lượng: Gom dừng mở và giữ journal để tránh dùng cấu hình dở dang. Tệp pending không hợp lệ được giữ thành tệp lỗi; cấu hình cũ tiếp tục được dùng.

Khi danh sách tài khoản đang ở chế độ bảo vệ chỉ đọc, thao tác sao lưu/khôi phục tạm khóa. Bản đầu không thay thế công cụ phục hồi toàn bộ hồ sơ hỏng, không tự đồng bộ đám mây và không chuyển dữ liệu đăng nhập giữa máy.
