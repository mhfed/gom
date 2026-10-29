# Kiểm chứng Khay trung chuyển — 2026-10-29

Nhánh `codex/transfer-shelf`, dựa trên bản sửa popup mobile/bong bóng 36 px. Phần Nhắc trả lời vẫn nằm riêng ở nhánh WIP. Không có thay đổi phiên bản, installer, phát hành hoặc cài đè `/Applications/Gom.app` trong công việc này.

## Phạm vi đã kiểm tra

- Typecheck: đạt.
- Unit suite: **211/211 đạt**, gồm kho mã hóa, quota, file nguồn độc lập, persistence/recovery, namespace, callback cũ, export và geometry.
- Build mã nguồn và định dạng các tệp thay đổi: đạt.
- Giao diện: headless Chrome ở 1280/940/400 px, sáng/tối; chữ nhiều dòng, nội dung giả dạng HTML, tên dài, ảnh, lọc/tìm/ghim/xóa/dọn, quota và trạng thái lỗi. Đã xem ảnh chụp đại diện. Snapshot giống hệt nhau không làm thay đổi DOM, cả khi khay đóng và mở.
- Electron Khay: **10 nhóm đạt**, gồm persistence qua lần mở lại, chữ/link/ảnh/tệp, khóa/chuyển qua lại, context menu và thoát giữa lúc xuất file.
- Native tabs: **16 nhóm đạt**, chín native page cùng bản nháp được giữ nguyên, snapshot không đổi tạo **0 DOM mutation**.
- Không gian kín: **17 nhóm đạt**; chat nổi: **12 nhóm đạt**, gồm reload một lần ở khung popup và bong bóng 36 px.
- Rà soát độc lập sau sửa: đạt; các vấn đề lưu trữ, shutdown, hủy commit, phản hồi từng file, vùng báo lỗi cuộn và tính hợp lệ của fixture đã được kiểm tra lại. Không còn P1/P2 chưa xử lý trong phạm vi rà soát.

## Các lỗi đã tái hiện rồi sửa

1. Kho nhận được nhiều đoạn chữ có dấu nháy/gạch chéo nhưng giới hạn đọc index cũ không đủ sau khi JSON escape. Đã kiểm tra đủ 100 mục × 64 KiB lưu rồi đọc lại đúng nội dung.
2. Hostname `.`/`..` có thể tạo nhãn không hợp lệ và làm kho bị khóa lỗi. Nhãn dự phòng an toàn giữ kho tiếp tục hoạt động.
3. Cửa sổ nhỏ có khay phủ trang vẫn có thể focus native page ẩn sau khi chọn tài khoản hoặc hiện lại app. Kiểm thử Electron RED rồi GREEN xác nhận focus ở shell và trang tiếp tục ẩn.
4. Thoát lúc xuất file từng có thể bỏ lại bản rõ tạm. Service giờ hủy chờ hộp thoại chưa trả về, chặn tác vụ mới và đợi việc ghi/dọn đang chạy trước khi quit. Fixture tạm dừng fsync kiểm tra app chưa thoát, sau đó tệp đích cũ còn nguyên và tệp tạm được dọn trước `will-quit`.
5. Rename bất đồng bộ từng có thể commit sau khi guard bị hủy. Kiểm tra quyền và rename cuối cùng giờ cùng một lượt đồng bộ của main event loop.
6. Chọn nhiều file có lỗi giờ nêu từng basename an toàn và lý do, không gửi đường dẫn đầy đủ hoặc tên từ không gian cũ. Lỗi thêm từ context menu cũng hiện phản hồi trong hộp thoại đúng không gian.
7. Khay và danh sách tài khoản chào mừng từng cập nhật DOM khi dữ liệu không đổi. Các regression MutationObserver đã thấy RED rồi GREEN 0 mutation, đồng thời vẫn kiểm tra cập nhật tên, logo, chưa đọc, số mục và đổi không gian.

## Fixture hồi quy được cập nhật

`native-tabs-check.mjs` vẫn giả định ba nền tảng từ trước, trong khi baseline `a9df171` đã có tám nền tảng. Fixture được cập nhật để theo dõi tám nền tảng và chín native view (thêm Zalo thứ hai), giữ kiểm tra ID/session/bản nháp/lượt tải và 0 mutation. Kiểm tra bàn phím dùng các tab đang nhìn thấy và menu overflow. Trước khi phục hồi foreground, helper bắt buộc xác nhận thao tác gốc đã chọn và hiển thị đúng một native page của tài khoản mong đợi; chọn sai sẽ tiếp tục thất bại, không được tự sửa bằng activate. Sau đó fixture mới đưa cửa sổ trở lại và gọi activate để kiểm tra focus, không trực tiếp focus native child. Khi lưu trữ tài khoản Messenger cuối, fixture xác nhận tab biến mất rồi mở nền tảng qua thư viện để kiểm tra trình thêm tài khoản.

## Giới hạn bằng chứng

Các lượt Electron chạy trên macOS bằng profile, tài khoản, protocol, file và dữ liệu giả trong thư mục tạm. Clipboard, hộp chọn/lưu file và safeStorage được thay ở ranh giới hệ điều hành; store, bridge, callback và native view của Gom vẫn chạy thật. Chưa xác nhận thủ công keychain, hộp thoại, dán ảnh trên các nền tảng thật hoặc runtime Windows cho tính năng mới này. Export ra ổ đĩa thực sự bị treo có thể khiến app chờ để không bỏ dở việc dọn dữ liệu.

Một lượt thử tích hợp đầu thiếu fake `clipboard.writeText`, nên đã thay clipboard hệ thống bằng chữ mẫu một lần. Fixture đã được sửa trước những lượt cuối; không đọc nội dung clipboard cá nhân và các lượt sau chỉ dùng clipboard giả.

Không dùng userData hay tài khoản đang đăng nhập của người dùng để kiểm thử. Ảnh QA dùng nội dung giả, không phải cuộc chat thật.
