# Kiểm chứng Nhắc trả lời — 2026-10-29

Trạng thái: đã hoàn thiện mã nguồn trên nhánh `codex/complete-reply-reminders`, nền Gom 0.8.1. Chưa nâng phiên bản, đóng gói installer, phát hành hay cài vào máy trong công việc này. Bản phát hành 0.8.1 chưa có Nhắc trả lời.

## Bằng chứng đã có

| Lệnh                                   | Kết quả cuối                          |
| -------------------------------------- | ------------------------------------- |
| `npm run typecheck`                    | Đạt                                   |
| `npm run build`                        | Đạt, chỉ build mã nguồn               |
| `npm test`                             | 248/248 đạt, không bỏ qua bài nào     |
| `node scripts/reminders-check.mjs`     | 15 nhóm đạt                           |
| `node scripts/native-tabs-check.mjs`   | 16 kiểm tra đạt, giữ 9 trang/bản nháp |
| `node scripts/private-space-check.mjs` | 17 kiểm tra đạt                       |
| `node scripts/floating-chat-check.mjs` | 12 nhóm đạt                           |
| `node scripts/shelf-check.mjs`         | 10 nhóm đạt                           |

- Core có **35 test** về store/service: định dạng, giới hạn, async codec, mã hóa, file hỏng, claim/release/ABA, mutation bị thu hồi, pause, shutdown, click thông báo và dung lượng gần đầy.
- Electron nhắc việc **15 nhóm đạt**: tạo thủ công, đa dòng/giờ tùy chỉnh qua khởi động lại, thông báo một lần, hoãn, hoạt động khi ẩn, pause, không gian kín, state/DOM/IPC cũ, claim đang ghi, tài khoản đã gỡ và file hỏng.
- Nhắc trả lời đóng Khay, đưa chat nổi về và che native view khi form mở. Fixture giữ ID trang, document/session và bản nháp.
- UI headless sáng/tối 1280/940/400 px, giới hạn 500 Unicode codepoint, note/HTML giả, form đổi giờ/hủy/focus, ngày sai/quá hạn, trạng thái rỗng/đã xong/đã gỡ/lỗi, kết quả trả muộn và snapshot không đổi với 0 DOM mutation đều đạt.
- Hồi quy UI Không gian kín 940 px và fixture Khay/full-shell startup cũng đạt.

## Những lỗi đã tái hiện và sửa

- Ghi chú trước đây xóa xuống dòng/tab và làm dính các từ. Regression giữ LF/tab, chuẩn hóa CRLF/CR, thay control/bidi bằng dấu cách đã RED→GREEN.
- Đổi giờ tùy chỉnh cho nhắc việc đã tạo trước đây thiếu. UI/editor dùng thao tác snooze với thời gian đã chọn, giữ tài khoản/note và lưu qua lần mở lại.
- Thao tác cũ từng không mang epoch, có thể ghi sau khi chuyển không gian. Mọi request giờ mang lockVersion, kiểm tra lại qua queue/async crypto/ghi tạm và trước rename đồng bộ. Hủy không làm kho khỏe chuyển sang lỗi.
- Native notification cần epoch riêng: ẩn Gom thường thu hồi IPC epoch nhưng vẫn phải cho bấm thông báo đã hiện. Hai regression cho ẩn thường và invalidate thật đều RED→GREEN; thao tác của việc khác không vô hiệu click của alert còn hợp lệ.
- Khởi tạo renderer trước state đầu từng gây lỗi đọc privateSpace từ undefined. Cả fixture headless mới và lượt Electron cũ đã thấy lỗi; sửa trạng thái đầu tùy chọn rồi build lại, Electron 15 nhóm đạt.
- Ghi/chọn giờ muộn sau khóa không hồi sinh modal; báo lỗi dài được chặn chiều cao và cuộn bằng bàn phím. Snapshot giống nhau không dựng lại form/danh sách.

Lượt review độc lập phát hiện một P2 về dung lượng sát 1 MiB: add thành công nhưng claim/complete tăng độ dài timestamp làm không ghi được. Đã sửa bằng cách kiểm tra bản chiếu mã hóa với độ dài timestamp lớn nhất trước khi nhận việc mới, giữ nguyên giới hạn và định dạng kho. Ba regression RED→GREEN xác nhận chặn bản ghi không đủ chỗ, claim/complete toàn bộ mục đã nhận, đổi giờ/khởi động lại và hủy lúc kiểm tra dung lượng mà không đổi dữ liệu. Review lại xác nhận đã xử lý, không có lỗi quan trọng mới.

## Đồng bộ fixture trong lượt hồi quy cuối

- Fixture nhắc việc từng chụp lockVersion trước khi sự kiện hide native hoàn tất, làm thao tác bị từ chối đúng theo guard. Giờ chờ sự kiện hide thật qua bộ đếm của bootstrap trước request tiếp theo; không tự thử lại request bị hủy.
- Caption tài khoản và nút mới làm hàng tab có lúc còn hai tab, có lúc ba. Fixture bàn phím lấy tab cuối đang hiển thị cho thao tác quay vòng/End, giữ kiểm tra ba tab ban đầu, hai lần ArrowRight liên tiếp, focus và bản nháp. Không sửa thuật toán bố trí tab.
- Fixture Khay chờ điều hướng welcome sau khi main load xong và cửa sổ foreground trước thao tác đầu mỗi lần mở lại. Preload bridge sẵn sàng sớm hơn giai đoạn này. Các kiểm tra thu hồi export/clipboard/picker sau chuyển không gian vẫn giữ nguyên.

Các chỉnh sửa cuối chỉ đồng bộ điều kiện đầu vào của fixture; không nới guard hay thay mã sản phẩm để làm kiểm tra đạt. Hồi quy Electron chạy tuần tự với hồ sơ giả độc lập.

## Giới hạn

Các kiểm tra dùng profile/home/userData tạm, protocol trang giả, crypto và native-notification doubles ở ranh giới hệ điều hành. Store, service, bridge, callbacks và native view chạy thật. Chưa kiểm chứng banner/quyền thông báo và keychain thực hoặc toàn bộ runtime Windows trong lượt phát triển này. Không dùng dữ liệu phiên thật, gửi tin nhắn hay cài scheduler hệ điều hành.
