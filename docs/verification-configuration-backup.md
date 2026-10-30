# Kiểm chứng Sao lưu cấu hình

Ngày 2026-10-30. Base `5e500fd`; worktree/nhánh `codex/config-backup`. Chỉ mã nguồn phát triển; không cài/phát hành hoặc dùng tài khoản thật.

- Toàn bộ **293/293 unit test** đạt, gồm 24 test mới về projection/parse/merge và pending/journal/startup. Typecheck/build đạt.
- Electron thật `scripts/backup-check.mjs`: **8 nhóm đạt**, toàn bộ account/site, appData/home, file picker, thông báo và restart fixture cách ly. Chỉ mock ranh giới OS/dữ liệu chậm; UI/preload/IPC/fs/catalog/startup dùng mã thật.
- Native kiểm chứng: export loại tên/ID/site riêng, cookie và nội dung; cancel giữ view/token/draft; malformed và collision từ chối trước ghi; epoch và thay đổi config thu hồi preview; hủy xác nhận/lỗi ghi bản bảo vệ không tạo pending; tên chứa HTML được vẽ như text; dọn DOM theo epoch; restore đóng/relaunch rồi giữ localStorage/ID kín trong catalog; ảnh sáng 940×640/tối 1280×800 không tràn ngang, chụp khi transition hoàn tất.
- Unit kiểm chứng bổ sung: ảnh PNG thật qua parse và ghi revision mới; default logo/site label/tab đóng và bỏ ghim được khôi phục; extra account/notification, private navigation, bounds và Focus hiện tại giữ nguyên; giới hạn/version/URL/path/ID sai bị chặn; marker pending không xuất hiện khi hủy; partial publish rollback và crash journal khôi phục ảnh trước; journal path vượt thư mục bị từ chối; pending hỏng/quá lớn được cách ly.

- Sau lượt sửa review: `resources-check.mjs` **13 nhóm**, `native-tabs-check.mjs` **16 kiểm tra** và `focus-check.mjs` **18 nhóm** đạt. Native-tabs lần đầu dừng ở `keyboard account menu cancellation retains shell keyboard focus` (main webContents chưa focused); chạy lại nguyên script không sửa đạt 16. Không coi lần lỗi là đạt.

## Rà soát độc lập

Một reviewer đọc toàn nhánh tìm **1 Critical và 3 Important**, không có Minor. Đã nhận và sửa một lượt; không gọi reviewer thứ hai. Từng lỗi có RED trước sửa, rồi 24 kiểm thử liên quan và toàn suite 293/293 GREEN:

1. Đường dẫn xuất qua symlink/case alias có thể ghi đè userData. Chuẩn hóa root và parent thật, kiểm tra containment, ghi/rename đến đường dẫn canonical đã kiểm tra. Test file thật chứng minh catalog không đổi; có cả ca xuất thành công ra thư mục cha hợp lệ.
2. Hợp nhất có thể làm toàn bộ catalog bị lưu trữ. Xác minh catalog hoàn chỉnh trước preview và tại startup trước publication; từ chối nếu không còn tài khoản chưa lưu trữ, không ghi metadata.
3. Cấu hình hợp lệ có mọi tài khoản thường lưu trữ không xuất được khi tài khoản đang dùng thuộc không gian kín. Tách validator subset khỏi quy tắc installation, chấp nhận subset trống/toàn bộ lưu trữ mà không thêm account công khai.
4. Revision cấu hình đổi khi chọn nơi lưu hoặc ghi tạm vẫn xuất snapshot cũ. Kiểm tra lại revision/epoch sau dialog và ngay trước rename; test gây thay đổi ở cả hai ranh giới, không có tệp xuất được công bố.

Lỗi guard canonical từ chối riêng relative parent `..` đã được native fixture bắt và bổ sung RED→GREEN cho xuất hợp lệ. Bộ gây thay đổi trong test ghi tạm dùng basename để không phụ thuộc alias `/var`/`/private/var` trên macOS.

Ảnh/JSON: `outputs/backup-check/`. Số liệu, tên và ngày tạo trong ảnh là của hồ sơ kiểm thử. Log toàn suite/native và hồi quy được giữ cùng outputs khi hoàn tất.

## Quyết định và giới hạn

Người dùng giao quyền chốt phạm vi và triển khai ngay. Chọn metadata thường + tùy chọn chung, tệp versioned/plain JSON, hợp nhất và restart. Không xuất dữ liệu riêng, không chuyển cookie/session, không tự sửa catalog chỉ đọc hoặc metadata chưa xác định. URL tự thêm là cấu hình người dùng, có thể chứa tham số của chính URL đó; không hứa đây là tệp không có thông tin cá nhân.

Thay đổi provider ID riêng chỉ thuộc Không gian kín bị từ chối chung, không gửi tên/URL kín. Parser không thêm builtin account vào subset xuất. Giao dịch chỉ ghi đích cố định và ảnh logo có filename từ ID/revision đã kiểm tra. Journal/before ảnh nằm cục bộ, mode 0600; không xuất ra renderer.

Nút khôi phục dùng pending nguyên tử và bắt đầu quit trong cùng bước công bố, không có await sau rename; startup xử lý trước bất kỳ đọc catalog/dựng trang. Một lần apply có nhiều metadata file, nên journal giữ ảnh trước để rollback khi app crash. Không có tuyên bố bảo đảm trước mất điện/phần cứng hỏng. Ảnh revision cũ/orphan không tự xóa trong bản đầu để tránh xóa tệp còn cần cho rollback.

Chưa chạy Windows trong lượt này. Các bộ private-space/reminders cũ từng timeout ở native hide/unlock trên cả base trong lượt Tài nguyên; xem `verification-resource-management.md`. Không dùng chúng để tuyên bố mọi GUI regression đạt.
