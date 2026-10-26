> Đã dừng theo yêu cầu mới: chat riêng từng nền tảng. Nội dung dưới đây là lịch sử nghiên cứu, không còn là điều kiện phát hành. Xem [phạm vi 0.5.3](superpowers/plans/2026-10-26-platform-tabs.md).

# Tiến độ kết nối chat thống nhất — 2026-10-26

**Chưa đủ điều kiện đóng gói giao diện mới.** Bản cài hiện tại vẫn là 0.5.2. Các module mới trong lượt này chưa nối vào main/preload/renderer; không đổi dependency, version hay installer. Thiết kế Mac tối giản đã duyệt vẫn là mục tiêu.

Người dùng đã cho phép nghiên cứu kết nối thử nghiệm qua trang đang đăng nhập của Zalo/Messenger và yêu cầu chỉ phát hành sau kiểm chứng. Sau khi được thông báo Messenger chưa đăng nhập và Zalo chưa mở lịch sử, người dùng chọn tiếp tục phần tự động, chưa tiện đăng nhập/mở cuộc trò chuyện kiểm thử.

## Đã làm và bằng chứng

| Hạng mục | Kết quả | Giới hạn |
| --- | --- | --- |
| Telegram TDLib | Nạp library, tạo hai client, nhận trạng thái chờ cấu hình, đóng cả hai và utilityProcess thành công trong Electron 45 arm64. Root đã chạy lại độc lập. | Chưa cấu hình API credentials, đăng nhập, lấy/gửi tin, đo tài nguyên có tài khoản hoặc thử ASAR. |
| Zalo danh sách đang render | Parser chỉ đọc được **13 hội thoại**, sau khi loại dòng tiện ích. ID khác nhau, kết quả không đổi ở hai lần đọc liền nhau. | Một phiên, một vùng render, chưa mở hội thoại; không chứng minh toàn bộ inbox, lịch sử, độ ổn định qua reload hoặc gửi thành công. |
| Kho bản nháp | Khóa theo account/conversation/topic; codec mã hóa bắt buộc; ghi atomic; revision và tombstone chặn ghi/xóa cũ; lỗi giải mã khóa ghi và giữ file. | Mới là module được test trên đĩa tạm; chưa nối safeStorage/Keychain hay trình soạn thật. |
| Kiểm thử mã nguồn | 89/89 tests ứng dụng, 9/9 tests công cụ chẩn đoán, typecheck và build pass. | Build ở đây chỉ kiểm tra biên dịch app hiện tại, không tạo bộ cài chat thống nhất. |

Phép đọc Zalo không click, cuộn, focus, thay nội dung hoặc gửi tin. Diagnostic output chỉ lưu cấu trúc/số lượng, không lưu tên, nội dung hay ID cá nhân. Parser xử lý title/preview trong bộ nhớ của isolated world, rồi chỉ trả số tổng hợp. Preview có thể là bản nháp của trang và không được coi là tin đã gửi. Trang và phiên cũ được giữ nguyên; không sao chép cookie/token/database.

Tổng hai lần parse cùng probe cấu trúc mất khoảng 0,7–1,4 ms trong các lần đo tại chỗ. Đây chỉ là thời gian chạy probe; **không phải** mức giảm CPU/RAM của app. Chưa thêm observer/polling vào runtime nên chưa có benchmark connector hoạt động nền để so sánh.

## Tệp triển khai

- `src/chat/model.ts`, `src/main/chat/draft-store.ts`: định danh và lưu bản nháp độc lập.
- `src/main/chat/zalo-dom.ts`: parser inbox Zalo giới hạn 40 hội thoại/3.000 node, coverage `rendered-window`; thiếu/đụng ID hoặc cấu trúc thay đổi thì dừng nhận dữ liệu.
- `scripts/research/web-inspect.mjs`: chỉ gắn vào cổng CDP loopback được chỉ định để đếm trang/cấu trúc, không khởi động hoặc đóng app, không có command gửi/import/eval tùy ý.
- `scripts/research/zalo-live-check.mjs`: gắn cổng CDP loopback của phiên nghiên cứu, đọc một lần trong isolated world rồi ngắt socket, không tắt app.
- `scripts/research/telegram-native-*`: smoke TDLib tách profile tạm, có pin phiên bản/integrity.
- `tests/chat-*.test.ts`, `tests/zalo-dom.test.ts`: kiểm tra định danh, lưu bền vững, lỗi và parser.

Bằng chứng cục bộ: `outputs/zalo-live-evidence.json`, `outputs/telegram-native-verification.json`. Nguồn và hạn chế chi tiết: [Telegram](telegram-connector-2026-10-26.md), [Zalo](zalo-web-connector-2026-10-26.md), [Messenger](messenger-web-connector-2026-10-26.md).

Rà soát độc lập phát hiện launcher chẩn đoán ban đầu dùng Playwright có thể đóng app khi dừng harness. Tiến trình harness cũ đã được tách/dừng riêng; kiểm tra hệ điều hành và CDP xác nhận app vẫn sống, cùng PID, không restart. Công cụ được đổi sang attach-only và thêm timeout cho kết nối. Đây là sửa công cụ nghiên cứu, không thay đổi runtime của bản 0.5.2.

Root đã chạy lại cả 9 test loopback, attach-only CLI tới phiên đang mở rồi thoát qua EOF, và chạy lại parser; app vẫn sống cùng PID. Hai finding của review (sở hữu vòng đời app và thiếu deadline kết nối) đã có kiểm chứng sửa. Công cụ dùng `ws` có sẵn trong cây dependency dev đã khóa; chưa thêm runtime dependency.

## Còn thiếu trước bản cài

1. Zalo: cuộc trò chuyện kiểm thử do người dùng chọn để xác minh pane ↔ conversation, lịch sử, trạng thái gửi/ACK và draft; thử đổi hội thoại, nhiều tài khoản và reload có chủ ý.
2. Messenger: người dùng đăng nhập trong trang chính thức; xác minh DOM và lịch sử E2EE. Không có parser Messenger được đoán từ trang đăng nhập.
3. Telegram: cấu hình `api_id`/`api_hash` cục bộ của ứng dụng và phiên TDLib mới; xây/kiểm thử auth, history/update/send, lưu phiên và native packaging. Không chuyển phiên Web K sang TDLib.
4. Nối connector đã kiểm chứng vào giao diện Mac đã duyệt, bảo vệ kết quả muộn sau đổi tài khoản/hội thoại, xử lý lỗi gửi không tự retry; test IME/EVKey, restart/offline và CPU/RAM trước/sau.

Không có tin nhắn thật nào được gửi trong lượt nghiên cứu này. Việc gửi thử thật sẽ do người dùng thao tác hoặc phải có chỉ định rõ người nhận/nội dung.
