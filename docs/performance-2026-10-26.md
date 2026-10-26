# Tối ưu CPU nền và bộ nhớ — 26/10/2026

Lượt tối ưu này giữ nguyên trang tài khoản, ID/partition và bản nháp đang mở. Mục tiêu là giảm việc do khung Electron tự tạo trong lúc idle, sau đó kiểm chứng bộ nhớ. Không tự đóng, reload hoặc đóng băng tài khoản để lấy mức RAM thấp hơn.

## Thay đổi

- Chỉ gửi AppState khi nội dung thay đổi; gộp kết quả khảo sát hoàn thành gần nhau trong tối đa 25 ms. Lệnh người dùng và lỗi vẫn cập nhật ngay. Trạng thái xác nhận cho cài đặt macOS được gửi lại ngay cả khi thao tác bị từ chối và dữ liệu không đổi, để checkbox không hiển thị sai.
- Gộp auth/unread/theme thành một lần `executeJavaScript`. Chỉ đọc toàn bộ text khi cần fallback nhận diện đăng nhập; chỉ lấy màu tài khoản đang chọn khi cửa sổ đang hiện và theme theo nền tảng. Yêu cầu đổi theme/chuyển tài khoản trong lúc probe đang chạy được giữ để làm ngay sau đó.
- Kết thúc miễn background throttling sau tối đa 30 giây, hoặc sớm hơn khi nhận diện đăng nhập. Trang chờ QR không còn được miễn vô thời hạn. Đây là throttling thông thường của Chromium, không unload hay freeze trang.
- Chỉ ghi những thuộc tính DOM, icon, Dock badge và bounds/visibility native có thay đổi. Settings đang ẩn được cập nhật khi mở; pointermove trên cùng lựa chọn command palette không ghi lại toàn bộ danh sách.
- Giảm cấp phát snapshot/DOM không cần thiết; cache chỉ giữ trạng thái hiện tại. Cache layout và hàng đợi probe dùng weak references, không giữ lịch sử hay giữ view đã đóng.

## Phương pháp đo

Chạy `scripts/performance-check.mjs` bằng Electron native trên Apple M1 Pro, 8 CPU logic, 32 GiB RAM, macOS kernel 24.4.0. Mỗi lần dùng home/appData tạm riêng và HTTPS fixture nội bộ; không đọc tài khoản cá nhân, Chrome profile hay Keychain.

Mỗi cấu hình 3/6/12 tài khoản đã đăng nhập giả và 3 trang chờ đăng nhập chạy hai lượt, đảo thứ tự ở lượt hai. Sau khi sẵn sàng, chờ 32 giây, ẩn cửa sổ, chờ 800 ms rồi lấy mẫu 20,4 giây. Các bản build trước/sau được giữ riêng cùng SHA-256. Không chạy các kiểm tra GUI đồng thời với phép đo; không dùng Playwright hoặc các cờ tắt background throttling trong tiến trình đo.

CPU lấy theo khoảng giữa hai lần `app.getAppMetrics()`. Working set là tổng các tiến trình và có thể đếm trùng bộ nhớ dùng chung, không phải private footprint. Bộ đo có instrumentation nên không dùng số CPU nhỏ để tuyên bố phần trăm tăng tốc thực tế. DOM records bao gồm gán lại cùng giá trị, không phải số lần layout/paint.

Fixture hoạt ảnh ở màn đăng nhập được đo riêng để kiểm chứng throttling. Nó không mô phỏng đầy đủ JavaScript, mạng, tin nhắn, âm thanh/cuộc gọi hoặc pin của Zalo/Messenger/Telegram thật.

## Kết quả fixture tĩnh

Trung vị hai lượt, mỗi lượt 20,4 giây khi cửa sổ đã ẩn. Dấu mũi tên là **trước → sau**:

| Kịch bản | Lần khảo sát JavaScript | State IPC | DOM records | Tổng CPU Electron, % | Tổng working set, MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3 đã đăng nhập | 45 → 15 | 20 → 0 | 1.200 → 0 | 0,046 → 0,015 | 634,3 → 629,5 |
| 6 đã đăng nhập | 90 → 30 | 35 → 0 | 2.835 → 0 | 0,052 → 0,030 | 887,5 → 879,2 |
| 12 đã đăng nhập | 180 → 60 | 65 → 0 | 7.995 → 0 | 0,118 → 0,032 | 1.323,3 → 1.279,8 |
| 3 chờ đăng nhập | 30 → 12* | 20 → 0 | 1.200 → 0 | 0,038 → 0,020 | 583,2 → 621,8 |

Các mẫu có 0 snapshot thực sự thay đổi. Sáu mẫu đã đăng nhập sau tối ưu đều loại bỏ toàn bộ state IPC/DOM dư và giảm đúng 2/3 số lần gọi khảo sát qua tiến trình. Đây là giảm số lời gọi, không phải cam kết giảm CPU/pin tương ứng.

\* Hai mẫu chờ đăng nhập sau tối ưu lần lượt có 15 và 9 probe; lịch thực thi trong ca này không đồng đều. Nhịp polling cấu hình vẫn là 4 giây. Không gán phần giảm vượt mức gộp hai lời gọi thành một cho riêng thuật toán tối ưu.

Khoảng working set giữa hai lượt:

| Kịch bản | Trước, MiB | Sau, MiB |
| --- | ---: | ---: |
| 3 đã đăng nhập | 633,8–634,8 | 628,8–630,2 |
| 6 đã đăng nhập | 887,0–887,9 | 879,0–879,3 |
| 12 đã đăng nhập | 1.246,4–1.400,1 | 1.183,4–1.376,2 |
| 3 chờ đăng nhập | 539,2–627,2 | 621,6–621,9 |

**RAM chưa giảm nhất quán:** chênh lệch ở 3/6 tài khoản nhỏ, khoảng đo 12 tài khoản rộng, còn trung vị ca chờ đăng nhập tăng. Không có cơ sở để hứa giảm RAM đáng kể hoặc kết luận rò rỉ. Số tiến trình giữ nguyên 7/10/16 cho 3/6/12 tài khoản.

CPU tĩnh đo được thấp hơn trong các mẫu này, nhưng tải rất nhỏ, số lượt ít và có overhead instrumentation. Báo cáo số tuyệt đối để đối chiếu, không chuyển thành tuyên bố phần trăm tiết kiệm CPU/pin của ứng dụng thật.

Ở ca chờ đăng nhập, trước tối ưu cả ba view vẫn miễn throttling sau warmup; sau tối ưu cả ba đã bật throttling. Cookie, storage, bản nháp và view identity qua đủ 16 mẫu tĩnh (96 lượt tài khoản) đều được bảo toàn.

## Trang đăng nhập giả có hoạt ảnh

Ba trang có vòng `requestAnimationFrame` với phép tính và chuyển động CSS; hai lượt trước và hai lượt sau, cùng thời gian warmup/đo. Các số dưới là trung vị:

| Chỉ số khi cửa sổ ẩn | Trước | Sau |
| --- | ---: | ---: |
| Frame trong 20,4 giây | 2.449 | 0 |
| Tổng CPU Electron | 4,147% | 0,021% |
| Idle wakeups/giây | 330 | 4 |
| View miễn throttling | 3 | 0 |
| Tổng working set | 647,8 MiB | 635,9 MiB |

CPU từng lượt: trước 4,243% / 4,052%; sau 0,0201% / 0,0217%. Cả ba trang sau tối ưu báo Page Visibility `hidden` khi cửa sổ ẩn, trong khi trước đó vẫn là `visible`.

Sau cửa sổ đo, đưa app ra trước và xác nhận focus + Page Visibility `visible`: cả hai lượt sau tối ưu đều chạy thêm 12 frame trên cùng webContents. Như vậy hoạt ảnh dừng khi ẩn và tiếp tục khi hiển thị, không phải do đóng hoặc mất trang. Dữ liệu phiên và bản nháp giữ nguyên trong cả bốn mẫu.

Đây là bằng chứng cho tác động của giới hạn miễn throttling trong workload tổng hợp này; **không phải dự báo CPU/pin của ba nền tảng thật**.

## Bảo toàn dữ liệu và kiểm tra

Trong mỗi mẫu native, kiểm tra cookie, localStorage, IndexedDB, textarea bản nháp, biến JavaScript của trang, URL và ID webContents trước/sau idle, chuyển qua mọi tài khoản và ẩn/hiện. Kiểm tra bản nháp áp dụng khi app đang chạy; việc phục hồi bản nháp sau thoát app vẫn phụ thuộc nền tảng.

59/59 kiểm tra đơn vị, typecheck và build đã qua. Các fixture persistence (ghi/đọc qua hai tiến trình), desktop, multi-account, shell 12 tổ hợp, command focus, theme, sidebar layout, vòng đời cửa sổ và renderer performance đều qua. Thông báo/OS permission dùng fixture hoặc mock; chưa kiểm chứng lại tin nhắn/cuộc gọi thật trên tài khoản cá nhân.

Rà soát độc lập phát hiện hai lỗi phụ do tối ưu (checkbox sau lệnh bị từ chối và refresh theme trong lúc probe đang chờ); cả hai đã được sửa, có regression RED/GREEN và kiểm tra Electron thực.

## Giới hạn RAM

Mỗi tài khoản còn giữ một web app hoạt động. Đó là phần lớn bộ nhớ thường trú, đồng thời giữ bản nháp, trạng thái trang và khả năng nhận thông báo/cuộc gọi. Lượt này giảm công việc/cấp phát dư nhưng giữ số view. Chưa triển khai chế độ ngủ tài khoản vì việc đóng trang có thể mất bản nháp chưa lưu hoặc ngừng hoạt động nền.

Kết quả RAM cần đọc cùng khoảng dao động giữa các lượt; không suy ra rò rỉ hay tiết kiệm RAM chắc chắn từ một snapshot. Đánh giá thực tế dài hạn cần đo private footprint và CPU với tài khoản thật trong phiên dài hơn.

## Tái hiện

```sh
npm run build
node scripts/performance-check.mjs --dist <before-dist> --label before
node scripts/performance-check.mjs --dist <after-dist> --label after
node scripts/performance-check.mjs --compare outputs/performance-comparison/before.json outputs/performance-comparison/after.json
node scripts/performance-check.mjs --dist <before-dist> --label before-activity --only-activity
node scripts/performance-check.mjs --dist <after-dist> --label after-activity --only-activity
node scripts/performance-check.mjs --compare outputs/performance-comparison/before-activity.json outputs/performance-comparison/after-activity.json --label activity-comparison
```

Dữ liệu đầy đủ và các build đối chiếu nằm trong `outputs/performance-comparison/` (không theo dõi Git): `before.json`, `after.json`, `comparison.json`, `before-activity.json`, `after-activity.json`, `activity-comparison.json` và `verification.json`. Build hiện tại đã đối chiếu SHA-256 trùng bản sau được đo; preload và platform preload giữ nguyên hash so với bản trước.

Sau khi hoàn tất đo, đã đóng gói bản cài thử cục bộ **0.5.1** theo yêu cầu: `outputs/TinNhan-macOS-arm64-0.5.1.zip`. Mã chạy trong gói trùng SHA-256 của build sau tối ưu đã đo. Đã kiểm tra ZIP, chữ ký ad-hoc và version; release công khai vẫn là 0.5.0.
