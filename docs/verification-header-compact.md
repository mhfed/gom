# Kiểm chứng Header B

Ngày 2026-10-30. Base `55bf81c`; nhánh `codex/header-compact`. Người dùng đã chọn mock B trước khi triển khai. Kiểm tra trên macOS với Electron 45, hồ sơ/appData/home tạm và trang giả lập; không dùng tài khoản thật, không phát hành hoặc cài lại Gom.

## Mã và giao diện

- `npm run typecheck`, `npm run build`: đạt.
- `npm test`: **295/295**, không bỏ qua, sau bản sửa review.
- `header-check.mjs`: **12 nhóm**. Header 52 px, một nút thêm, không còn nút riêng trùng thao tác; active/pinned luôn có tên; 940/1280 px sáng/tối với tên website dài, Focus và overflow. Khay và giờ kết thúc Focus không bị CSS cũ ẩn ở 940 px.
- Các menu +/tài khoản/Công cụ dùng template và click handler thật; fixture chỉ thay OS popup để chọn/đóng có kiểm soát. Hành động chạy sau dismissal, editor/Focus giữ focus bàn phím; đổi nền tảng và thao tác menu giữ native document/draft trong các kịch bản đã đo.
- Chọn menu rồi đổi account/panel, mở/đóng editor, khóa không gian hoặc gặp crash không chạy lựa chọn cũ. Có cả vòng đi rồi quay lại và phản hồi IPC bị giữ lại sau dismissal: main chấp nhận lựa chọn trước, renderer vẫn từ chối khi ngữ cảnh đã thay đổi.
- Workspace kín trống vẫn mở được Công cụ, không lộ tên tài khoản thường. Trang crash khóa chat nổi/thao tác trang; Công cụ toàn cục vẫn mở được mà không tạo thêm trang.

## Hồi quy sau sửa review

| Kiểm tra                         | Kết quả                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `native-tabs-check.mjs`          | 16 kiểm tra; 9 native pages/drafts được giữ; kiểm tra bounds, bàn phím, menu, editor và zero DOM mutations |
| `command-focus-check.mjs`        | Đạt: trả focus về trang và không mở palette trên editor                                                    |
| `focus-check.mjs`                | 18 nhóm                                                                                                    |
| `resources-check.mjs`            | 13 nhóm                                                                                                    |
| `backup-check.mjs`               | 8 nhóm                                                                                                     |
| `floating-chat-check.mjs`        | 12 nhóm                                                                                                    |
| `manual-updates-check.mjs`       | 9 nhóm; badge chuyển sang Công cụ                                                                          |
| `renderer-performance-check.mjs` | Đạt: snapshot không đổi không ghi DOM, giữ icon Công cụ, cập nhật unread/theme và giữ draft                |
| `private-space-ui-check.mjs`     | Đạt: nhãn ngắn, scrub dữ liệu và hủy kết quả cũ                                                            |

Fixture cũ được chuyển sang chọn mục native menu, không giữ button DOM vô hình. Bài stress nền tảng đạt toàn bộ 15 ca trong lượt cuối sau khi cập nhật kỳ vọng theo metadata hiện có. Đồng thời cập nhật các giả định đã cũ: tám nền tảng mặc định, API `importSession`, loại root WebContents khỏi danh sách trang dịch vụ, làm mới preview sao lưu sau thay đổi theme vì revision cấu hình đã đổi; chọn nền tảng từ màn Chào mừng sau khởi động; và không giữ tab mở cho nền tảng chỉ có tài khoản lưu trữ.

Native-tabs có các lần dừng ở focus hệ điều hành (palette hoặc roving keyboard). Không coi các lần đó là đạt. Lượt cuối chạy lại nguyên script, không nới assertion và không trực tiếp ép focus vào child view, đạt 16. Các GUI fixture chạy tuần tự; hai fixture Chromium chạy headless.

## Rà soát độc lập

Một reviewer toàn nhánh: **0 Critical, 1 Important, 1 Minor**. Đã sửa cả hai, không gọi reviewer thứ hai.

Important: kiểm tra account/panel bằng equality chưa đủ khi người dùng đổi đi rồi quay lại. Native fixture đã chứng minh RED: lựa chọn đổi theme cũ vẫn chạy. Sửa bằng revision tương tác tăng đơn điệu trước publication/snapshot, gồm account, panel, view epoch và trạng thái modal/operation. Main kiểm tra revision lúc menu đóng; renderer lấy snapshot main trước/sau menu để loại phản hồi trễ. Các ca account/panel/editor round trip và held IPC response đều GREEN; toàn suite 295/295 và typecheck/build đạt sau sửa.

Minor: tên mục đổi giao diện trong hướng dẫn được chỉnh đúng “Đổi sáng / tối”.

## Tệp kiểm chứng

Ảnh và JSON tại `outputs/header-check/`: `header-940-light-bar.png`, `header-1280-dark-bar.png`, hai ảnh toàn shell và `verification.json`. Trang chat trong ảnh là fixture; ảnh shell không bao gồm native child compositor. Các fixture native riêng xác minh bounds/identity của trang dịch vụ. Log các lệnh được lưu trong `outputs/header-check/logs/`.

Mã nguồn được lưu cục bộ trên nhánh hiện tại. Không push, merge, đóng gói installer hoặc sửa dữ liệu app thật.
