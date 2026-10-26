# Tin Nhan 0.5.4: DMG và cập nhật thủ công

Người dùng đã chọn phương án không mua chứng chỉ Apple: DMG để chia sẻ, kiểm tra phiên bản trong app, mở trang tải và tự thay ứng dụng. Phạm vi này được chốt trong hội thoại; không yêu cầu duyệt lại.

Giữ Electron Forge, macOS arm64, bundle ID và userData/partition hiện tại. Tạo cả DMG (app + lối tắt Applications, hướng dẫn cài) và ZIP; tiếp tục chữ ký ad-hoc, không nhận là notarized. Gói chỉ chứa runtime/asset cần thiết, không chứa tài khoản hay mã nghiên cứu.

Nguồn cập nhật cố định: GitHub Releases công khai mhfed/tin-nhan-desktop. Chỉ đọc metadata qua HTTPS không token/cookie. Lấy stable latest, kiểm tra semantic version và asset phù hợp arm64/x64/universal. Release notes chỉ là văn bản, URL mở chỉ được dựng/xác minh thuộc đúng repository. Không tải/chạy mã hoặc tự thoát app. Lỗi mạng, rate limit, 404, metadata hỏng và bản mới chưa có gói phù hợp phải báo đúng; không báo giả rằng đã mới nhất.

Cài đặt có mục Cập nhật với phiên bản hiện tại/mới nhất, thời gian kiểm tra, ghi chú, Kiểm tra cập nhật và Tải bản mới (mở trang release bằng trình duyệt). Menu Tin Nhan có Kiểm tra cập nhật. Có chỉ báo nhỏ ở nút Cài đặt khi có bản mới; không popup cưỡng bức khi đang chat. Tự kiểm tra một lần sau30giây khi chạy bản đóng gói, sau đó12giờ/lần; có checkbox tắt. Không check nền ở dev hoặc khi máy ngủ. Timeout10giây, response tối đa512KiB, chỉ1request đang chạy.

Phiên đăng nhập ở thư mục riêng giữ nguyên qua thay app. Không hứa giữ bản nháp chưa được nền tảng lưu qua lần thoát; UI hướng dẫn lưu bản nháp trước khi thay app. Không cài đè bản đang chạy, không công khai release mới nếu chưa được yêu cầu; chuẩn bị artifact và hướng dẫn phát hành cho những lần sau.
