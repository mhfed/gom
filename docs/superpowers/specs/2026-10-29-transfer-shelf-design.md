# Khay trung chuyển của Gom

Ngày: 2026-10-29. Trạng thái: **thiết kế để duyệt; chưa triển khai**.

## Ý định và quyết định đã có

Người dùng đã đồng ý ý tưởng một khay giữ nhiều đoạn chữ, liên kết, ảnh và tệp để dùng lại khi chuyển giữa các nền tảng trong Gom. Người dùng chọn **giữ nội dung sau khi thoát Gom**. Khay của Không gian thường và Không gian kín tách riêng, theo đề xuất đã trình bày trong cuộc trò chuyện.

Ví dụ: gom đoạn mô tả, ảnh sản phẩm và tệp báo giá vào Khay; chuyển từ Telegram sang Zalo; lấy từng món ra để dán hoặc đính kèm cho khách. Người dùng vẫn chọn người nhận, xem nội dung và gửi trong giao diện của nền tảng.

## Các cách đã cân nhắc

1. **Khay trong bộ nhớ, xóa khi thoát app.** Ít việc lưu trữ hơn, nhưng mất nội dung đang gom dở và không đáp ứng lựa chọn của người dùng.
2. **Khay lưu trên máy.** Giữ cả mục thường và mục ghim qua lần mở lại, có thao tác xóa và dọn khay. Cần quản lý dung lượng, bản sao tệp và ghi dữ liệu bền vững. **Người dùng đã chọn cách này.**

Phạm vi thao tác, giới hạn và cách bảo vệ dữ liệu bên dưới là đề xuất của người thiết kế để duyệt, chưa phải các lựa chọn người dùng đã xác nhận riêng.

## Phạm vi bản đầu

- Ngăn Khay trong cửa sổ chính, mở bằng nút biểu tượng kèm số mục của không gian hiện tại. Chuyển nền tảng/tài khoản trong cùng không gian vẫn giữ khay mở.
- Thêm văn bản thủ công, hoặc bấm **Lấy từ clipboard** để nhận ảnh hay chữ/liên kết. Chỉ đọc clipboard tại lần bấm đó.
- Thêm tệp bằng hộp thoại **Chọn tệp…**. Gom tạo bản sao riêng, giữ nội dung tại thời điểm thêm; sửa, đổi tên hoặc xóa bản gốc không làm đổi mục trong khay.
- Trong menu chuột phải của trang đang được phép dùng, thêm **Lưu đoạn chọn vào Khay** và **Lưu liên kết vào Khay** khi có nội dung tương ứng. Ảnh dùng thao tác Sao chép ảnh hiện có rồi Lấy từ clipboard.
- Tìm theo chữ/nội dung văn bản/tên tệp, lọc Tất cả / Chữ & link / Ảnh / Tệp. Mục ghim ở trên; các mục còn lại mới nhất trước.
- Ghim/bỏ ghim, xóa từng món, **Dọn mục chưa ghim** có bước xác nhận ghi rõ số mục. Không tự hết hạn hay tự xóa khi đủ dung lượng.
- **Sao chép** chữ, liên kết hoặc ảnh để dán vào trang đang dùng. Với tệp, **Lưu bản sao…** mở hộp thoại chọn nơi lưu; sau đó người dùng đính kèm bằng giao diện nền tảng. Không tự mở hay chạy tệp.

Bản đầu chưa bao gồm kéo tệp từ khay sang trang, thu tệp tải xuống trực tiếp từ cuộc chat, đọc lịch sử tin nhắn, tự theo dõi clipboard, tự chèn/tự gửi tin, đồng bộ máy khác hoặc mở khay trong cửa sổ chat nổi. Các thao tác này có vòng đời và phụ thuộc nền tảng riêng, không được trình bày như đã có.

## Giao diện và thao tác

- Dùng màu, kiểu chữ, biểu tượng và chế độ sáng/tối hiện có của Gom. Tên nút chính là **Khay**, không dùng thuật ngữ kỹ thuật về clipboard, mã hóa hay IPC trong luồng thường.
- Khay rộng 340 px, bắt đầu dưới thanh điều hướng 52 px. Từ chiều rộng cửa sổ 940 px trở lên, chừa đúng vùng này ở bên phải và thu phần trang chat còn lại; không tải lại hoặc tạo lại native view.
- Khi vùng cửa sổ hẹp hơn 940 px, hiển thị khay phủ phần nội dung bên dưới header và tạm ẩn native view. Đóng khay khôi phục nguyên view và bản nháp. Không để CSS đơn thuần phủ lên WebContentsView.
- Phần đầu: tên khay và nhãn không gian, số món, tìm kiếm, nút đóng. Các nút thêm nằm ngay phía trên danh sách. Trạng thái trống hướng dẫn chọn tệp hoặc lấy nội dung vừa sao chép.
- Thẻ chữ giữ xuống dòng; link hiển thị dạng chữ và hostname, không tải preview từ mạng. Thẻ ảnh có thumbnail giới hạn; thẻ tệp có tên và dung lượng. Nội dung dài có mở rộng trong chính ngăn khay, không tạo một modal nằm trên native view.
- Nút sao chép báo **Đã sao chép**, khay vẫn mở. Khi đóng bằng Escape hoặc nút X, trả focus về phần trang đã dùng nếu vẫn hợp lệ; không giành focus sau một lệnh từ workspace cũ.
- Khi mở màn hình cài đặt, command palette, trình sửa tài khoản hoặc modal hiện có, đóng khay trước. Mở khay không thay tài khoản đang chọn và không đưa trang chat nổi về main.
- Sau khi khởi động lại, khay bắt đầu đóng; nút Khay phản ánh các mục đã lưu trong không gian thường. Nội dung khay kín chỉ được nạp vào renderer sau khi mở khóa và vào không gian kín.

## Dữ liệu bền vững

Main process sở hữu `ShelfStore`, có hai namespace nội bộ `normal` và `private`. Renderer không được chọn namespace hoặc truyền đường dẫn đọc tệp tùy ý.

Một mục gồm ID ngẫu nhiên, loại, thời gian tạo, trạng thái ghim, nội dung chữ hoặc ID blob, tên tệp an toàn, MIME do main xác định và kích thước. Không ghi nguồn tài khoản, tên người chat, URL trang đang mở hoặc dữ liệu HTML. Văn bản giữ LF/tab hợp lệ; không xóa dấu cách làm dính các từ.

Các giới hạn đề xuất cho mỗi không gian: 100 mục, tổng 250 MiB, mỗi tệp/ảnh 50 MiB, văn bản tối đa 64 KiB UTF-8. Chọn tối đa 10 tệp một lần; xử lý từng tệp tuần tự và báo rõ món nào không thêm được. Tệp rỗng được phép; thư mục và symlink bị từ chối. Giới hạn ảnh giải mã/pixel, byte thumbnail và kích thước IPC do người triển khai chốt có kiểm thử để tránh tải bộ nhớ không giới hạn.

- Lưu tại thư mục riêng trong userData, không nằm trong repo, gói cài đặt, thư mục tệp gốc hay log.
- Dùng khóa dữ liệu ngẫu nhiên do OS safeStorage bảo vệ; index và blobs mã hóa xác thực bằng API chuẩn của Node, nonce riêng từng bản ghi và namespace/ID gắn vào dữ liệu xác thực. Không lưu bản rõ của tên tệp, chữ hoặc thumbnail trên đĩa trong kho khay.
- Đây là bảo vệ theo tài khoản hệ điều hành. Mật khẩu Không gian kín tiếp tục khóa quyền truy cập qua Gom; không tuyên bố mật khẩu này mã hóa lại session Chromium hoặc chống công cụ của cùng tài khoản OS.
- Thêm blob xong mới commit index bằng ghi tạm và đổi tên; mutation được tuần tự hóa. Chỉ báo thành công sau commit bền vững. Khi lỗi ghi/giải mã/index hỏng, giữ dữ liệu hiện có, báo lỗi khay và không thay bằng kho trống.
- Xóa cập nhật index trước rồi dọn blob không còn tham chiếu. Dọn tệp mồ côi theo định dạng do app sở hữu sau khi đọc/giải mã index thành công; không tự dọn khi index/key lỗi. Chờ tác vụ đang ghi khi thoát app như các kho dữ liệu khác.
- Khi safeStorage không khả dụng hoặc mất khóa của kho đang có, khay báo chưa đọc/lưu được; không hạ xuống bản rõ hay tự tạo khóa thay kho cũ. Không thay app name/userData/bundle ID hiện có.

Tệp xuất bằng **Lưu bản sao…** và nội dung đã sao chép vào clipboard được người dùng chủ động đưa ra ngoài kho khay. Có dòng trợ giúp ngắn trong khay kín: nội dung đã sao chép hoặc lưu ra ngoài vẫn ở ngoài Gom sau khi khóa. Gom không tự xóa clipboard của người dùng hay tệp xuất.

## Ranh giới quyền và vòng đời

- IPC chỉ cho main frame của shell tin cậy. Mọi list/read/pin/delete/copy/export kiểm tra item thuộc namespace đang hoạt động; đoán ID không cho phép truy cập mục không gian khác.
- Snapshot AppState chỉ chứa số mục/trạng thái của không gian hiện tại. Danh sách, nội dung và thumbnail lấy theo yêu cầu có giới hạn; không đưa toàn bộ blobs vào broadcast định kỳ. Không lộ số mục kín, tên tệp, thumbnail, đường dẫn, lỗi chứa nội dung kín hoặc cache từ không gian cũ.
- Mỗi tác vụ chụp namespace và `privacyGeneration` trước khi bắt đầu; kiểm tra lại sau hộp thoại/đọc tệp/đọc clipboard/giải mã và trước ghi kho, ghi clipboard, xuất tệp hoặc trả preview. Chuyển thường → kín → thường vẫn hủy callback cũ.
- Khi đổi không gian/khóa, đóng khay, xóa DOM, tìm kiếm, nội dung soạn thêm và preview; revoke blob URL; hủy các kết quả muộn. Không chuyển nội dung khay theo tài khoản được phân loại lại.
- File picker do main mở và xác thực regular file qua descriptor; renderer không có API đọc đường dẫn bất kỳ. Nội dung từ trang chỉ qua context menu sở hữu, không thêm bridge đọc/ghi khay vào trang từ xa. Nhãn và chữ render bằng textContent; không chạy HTML/SVG do người dùng cung cấp.
- Layout của main chừa vùng khay trước khi hiện UI; view đang ở floating window tiếp tục do FloatingChat quản lý. Mở/đóng/resize khay không reload provider, đổi partition hay tạo session mới.
- Dùng save dialog của hệ điều hành cho xuất file, kiểm tra workspace còn đúng trước khi ghi. Không tạo bản rõ tạm để preview, không tự mở file xuất. Chi tiết xử lý ghi xuất đang diễn ra lúc khóa do người triển khai chốt theo nguyên tắc: không xuất nội dung kín sau khi tác vụ bị hủy; dọn phần tệp chưa hoàn tất do Gom tạo, không xóa nội dung cũ của người dùng.

## Kiểm chứng để coi là đạt

1. Unit tests cho định dạng/giới hạn, giữ xuống dòng, bản sao độc lập với tệp gốc, quota, thứ tự ghim, ghi tuần tự và lỗi đọc/ghi/crypto không phá dữ liệu; ciphertext không chứa fixture chữ/tên tệp rõ.
2. Fixture Electron dùng profile và file giả: thêm chữ/link/ảnh/tệp, khởi động lại và lấy lại đúng bytes; thao tác copy và xuất chọn nơi lưu; xóa/dọn chỉ tác động đúng namespace; không tự gửi tin.
3. Các trường hợp đua: khóa/chuyển qua lại lúc file picker đang mở, đang đọc/ghi/giải mã hoặc export; request dùng epoch/ID cũ bị chặn và không trả preview/ghi clipboard/xuất sang không gian khác.
4. Native view ID, session, bản nháp giữ nguyên khi mở/đóng khay, đổi tab và resize; bounds không đè khay. Chat nổi và popup reload/bong bóng 36 px hiện có giữ đúng hành vi.
5. QA giao diện sáng/tối, 940 px, cửa sổ nhỏ theo màn hình, dữ liệu dài/trống/hết quota/lỗi, keyboard/focus và modal phối hợp. Chạy typecheck, unit suite và smoke khay; thêm regression suite native/private/floating bị ảnh hưởng.

## Phần để người triển khai quyết định

Tên module, schema IPC chi tiết, bố trí nút phụ, cấu trúc file mã hóa và chính xác định dạng thumbnail có thể chốt trong kế hoạch nếu giữ đúng các hợp đồng trên. Mọi giới hạn hiển thị trong UI dùng cùng một nguồn với main. Không thêm phụ thuộc nặng hoặc dịch vụ mạng chỉ để làm khay.

## Giao hàng và các công việc đang có

Triển khai trên nhánh riêng dựa trên sửa popup mobile/bong bóng đã có. Nhắc trả lời vẫn giữ riêng ở nhánh WIP; không trộn vào tính năng này. Bốn tài liệu untracked có từ trước được giữ nguyên.

Phạm vi hiện tại là thiết kế và bản phát triển để kiểm tra. Không nâng phiên bản, phát hành hay cài đè Gom đang dùng trong bước này; người dùng đã dặn chưa vội build/cài khi trao đổi tính năng trước. Việc build kiểm tra mã nguồn không đồng nghĩa đóng gói/phát hành installer.
