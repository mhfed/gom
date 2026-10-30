# Sao lưu và khôi phục cấu hình

Ngày: 2026-10-30. Người dùng giao quyền tự chốt phạm vi và triển khai, bỏ qua vòng hỏi/duyệt thiết kế riêng. Phát triển từ `5e500fd`; không phát hành hoặc cài app thật.

## Phạm vi

Tệp JSON có phiên bản `gom-config`, version 1, tối đa 8 MiB. Chứa cấu hình Không gian thường: tên/avatar/thứ tự/trạng thái lưu trữ tài khoản; nền tảng tự thêm; tab/ghim, độ rộng sidebar, theme; tùy chọn thông báo, phím tắt, kiểm tra cập nhật; logo mặc định/PNG 64×64 tối đa 32 KiB mỗi ảnh. Bao gồm các tùy chọn chung mà người dùng thấy trong Không gian thường.

Không xuất account/điều hướng riêng của Không gian kín, mật khẩu/verifier, cookie/partition/session, nội dung chat, Khay, Nhắc trả lời, bản nháp, bounds máy, phiên Tập trung đang chạy hay trạng thái ngủ tài khoản. Tệp là văn bản thường có tên tài khoản và URL người dùng cấu hình; không gọi nó là bản sao toàn bộ dữ liệu hay phương thức chuyển đăng nhập.

## Cách tiếp cận

- Chỉ xuất các tùy chọn giao diện: đơn giản nhưng thiếu danh sách nền tảng/tài khoản khi chuyển máy.
- Tệp cấu hình có phiên bản và metadata công khai, hợp nhất khi khôi phục: **chọn**, đáp ứng chuyển máy và khôi phục cài đặt mà giữ phiên có sẵn.
- Sao chép thư mục hồ sơ/phiên hoặc đồng bộ đám mây: không chọn, khác phạm vi và phụ thuộc máy/hệ điều hành.

Quyết định do người triển khai chọn theo ủy quyền, không gán cho người dùng.

## Luồng

Cài đặt → Sao lưu có hai hành động Xuất cấu hình, Chọn tệp khôi phục. Chỉ thao tác trong Không gian thường. File picker hệ điều hành do main process mở; renderer chỉ nhận tên tệp, token ngẫu nhiên và bản xem trước số tài khoản mới/cập nhật/nền tảng/logo cùng thời gian tạo, danh sách tên tài khoản và URL nền tảng được thêm. Dùng textContent, không render HTML từ tệp.

Khôi phục có nút Hủy và **Khôi phục và khởi động lại**. Nêu rõ các trang tải lại và bản nháp chưa lưu có thể mất. Không áp dụng trước xác nhận. Lưu bản cấu hình thường hiện tại vào thư mục `configuration-backups` trước; có nút mở thư mục. Lỗi lưu bản bảo vệ hoặc lỗi ghi pending: giữ nguyên app.

Thao tác có lockVersion; token chỉ dùng cho epoch hiện tại và một lần, bị thu hồi khi đổi/khóa không gian. Nếu cấu hình đổi sau xem trước, yêu cầu chọn/xem lại. Chặn khi catalog chỉ đọc, import/account operation/ngủ-thức đang chạy, quit hoặc update đang cài. Không cho renderer cung cấp đường dẫn. Không xuất đè tệp bên trong userData.

## Hợp nhất và giao dịch

Giữ tài khoản hiện có không có trong tệp. Cùng ID chỉ cập nhật metadata nếu cùng provider và đều thường; trùng ID kín hay đổi provider bị từ chối chung, không lộ tên/ID kín. Không sửa URL của provider hiện có; cùng ID khác URL từ chối. Thêm account/provider mới theo UUID đã kiểm tra, giữ partition suy ra từ ID. Không chạm private membership, khóa, nội dung hay trạng thái ngủ. Các tùy chọn chung/normal navigation trong tệp được áp dụng; focus hiện tại và thông báo của ID ngoài tệp giữ nguyên.

Không thay metadata khi trang đang chạy. Xác nhận tạo một tệp pending nguyên tử rồi thoát bình thường và relaunch. Startup áp dụng trước khi đọc catalog/settings hay dựng trang. Giao dịch stage tệp mới, journal local chứa ảnh trước, đổi metadata đồng bộ rồi bỏ pending/journal. Crash giữa các đổi tệp được rollback trước bất kỳ đọc catalog nào; rollback không thành công thì dừng startup, giữ journal. PNG dùng revision mới, không ghi đè ảnh cũ; orphan không được tham chiếu không ảnh hưởng cấu hình.

Chỉ cho journal ghi các filename cố định và ảnh logo có ID/revision hợp lệ. Parser, count, URL, PNG, ID, references và version được kiểm tra trước mutation. Pending lỗi được giữ thành tệp lỗi và thông báo, cấu hình cũ còn dùng. Tất cả writer đang chạy đã đóng khi restart; không có ghi xen kẽ.

## Kiểm chứng

Unit: lọc private/secret/transient, roundtrip, input hỏng/quá lớn/phiên bản mới, trùng ID, URL khác, giữ private/extras/focus, lỗi ghi backup/pending, hủy theo epoch; transaction rollback/crash recovery với file thật.
Electron fixture bằng dữ liệu giả: export không có dữ liệu kín/session, preview/cancel không mutation, restore/restart đúng cấu hình và partition/draft tài khoản khác trước restart, stale token/private IPC từ chối, malformed/failed persistence giữ cấu hình, bản bảo vệ đọc lại được, layout sáng/tối ở 940/1280. Không truy cập tài khoản thật.

## Chốt sau rà soát triển khai

Export dùng đường dẫn parent/root canonical để chặn symlink/case alias trỏ vào userData, kiểm tra revision sau dialog và trước rename. Subset thường có thể trống/toàn bộ lưu trữ; không dùng quy tắc installation để từ chối export subset. Catalog hoàn chỉnh sau merge phải qua validator hiện hành và giữ ít nhất một account chưa lưu trữ. Những quyết định này sửa các case biên của cùng phạm vi đã được ủy quyền.
