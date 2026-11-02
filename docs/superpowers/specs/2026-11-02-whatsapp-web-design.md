# Kết nối WhatsApp Web trong Gom

Ngày: 2026-11-02.

## Mục đích và hướng đã chọn

Bạn đã chọn **WhatsApp Web trong Gom** để dùng tài khoản WhatsApp ngay cạnh các nền tảng hiện có. Gom mở giao diện chính thức tại `https://web.whatsapp.com/`; mỗi tài khoản có vùng lưu trữ riêng trên máy.

Các hướng đã cân nhắc:

- **WhatsApp Web tích hợp sẵn — đã chọn:** phù hợp với cách Gom đang mở Zalo, Telegram và Messenger; dùng giao diện WhatsApp và liên kết thiết bị trực tiếp.
- **WhatsApp Business API:** dành cho một luồng tích hợp nghiệp vụ khác; không phù hợp mục tiêu dùng WhatsApp Web bạn vừa chọn.
- **Thêm website riêng bằng URL:** có thể tận dụng cơ chế hiện tại, nhưng không cung cấp sẵn logo, hướng dẫn đăng nhập và nhận diện trạng thái dành cho WhatsApp. Đề xuất thêm WhatsApp thành nền tảng có sẵn.

## Luồng sử dụng

1. Mở dấu **+** trên thanh tab, tìm **WhatsApp**, rồi mở nền tảng.
2. Gom mở tài khoản mặc định **Cá nhân** theo cơ chế tài khoản hiện có. Có thể chọn **Thêm tài khoản** để tạo tài khoản WhatsApp khác và đặt tên riêng.
3. Trang WhatsApp Web chính thức hiển thị cách liên kết thiết bị. Người dùng mở **Thiết bị liên kết → Liên kết thiết bị** trên điện thoại để quét mã QR do WhatsApp cung cấp; lựa chọn liên kết bằng số điện thoại, nếu trang cung cấp, dùng nguyên luồng chính thức.
4. Sau khi WhatsApp hoàn tất liên kết và tải giao diện trò chuyện, Gom hiển thị **Đã kết nối · Phiên riêng trên máy**.
5. Khi chuyển tab, Gom dùng lại cùng trang. Khi thoát và mở lại, Gom sử dụng lại dữ liệu phiên đã lưu; WhatsApp có thể yêu cầu liên kết lại nếu phiên hết hiệu lực hoặc bị thu hồi.

## Giao diện đề xuất

- Dùng bố cục, kích thước icon, hộp thêm tài khoản và thư viện nền tảng đang có; không tạo màn hình đăng nhập thay cho WhatsApp.
- Tên hiển thị thống nhất: **WhatsApp**. Logo biểu tượng WhatsApp được đóng gói cục bộ và ghi nguồn trong danh sách tài sản thương hiệu.
- Màu nhận diện đề xuất: xanh `#25D366`; chữ và nền tiếp tục dùng hệ màu của Gom để giữ độ tương phản.
- Thêm WhatsApp cuối danh sách nền tảng mặc định để giữ vị trí và phím tắt của các nền tảng trước đó. Thứ tự tab và ghim mà người dùng đã lưu được giữ nguyên; WhatsApp vẫn có trong thư viện để mở.
- Logo xuất hiện nhất quán ở tab, thư viện nền tảng, tài khoản, thông báo và hộp chọn logo thông qua các thành phần dùng chung.
- Trong phần nhập phiên Chrome, tài khoản WhatsApp hiện hướng dẫn **Mở WhatsApp trong Gom và liên kết thiết bị trên điện thoại**; không đưa người dùng vào một thao tác nhập phiên chưa được hỗ trợ.

Luồng màn hình:

```text
Thư viện nền tảng       Tab WhatsApp                 Sau khi liên kết
┌───────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ WhatsApp     Mở   │ →│ WhatsApp · Cá nhân      │ →│ WhatsApp · Cá nhân      │
└───────────────────┘  │ [Trang liên kết thiết bị│  │ [Giao diện trò chuyện  │
                       │  chính thức, có mã QR]  │  │  của WhatsApp Web]      │
                       └────────────────────────┘  └────────────────────────┘
```

## Trạng thái và phục hồi

- **Đang kết nối…:** trang đang tải hoặc đang kết nối lại.
- **Đăng nhập để bắt đầu:** đã nhận diện được màn hình liên kết thiết bị.
- **Sẵn sàng:** trang đã tải nhưng chưa đủ bằng chứng xác định trạng thái đăng nhập; không coi việc tải xong URL là đăng nhập thành công.
- **Đã kết nối · Phiên riêng trên máy:** có dấu hiệu giao diện đã đăng nhập được kiểm chứng trên WhatsApp Web thực tế, gồm trường hợp tài khoản chưa có cuộc trò chuyện.
- Lỗi mạng và tải trang dùng màn hình thử lại hiện có. Thử lại không xóa dữ liệu phiên.
- Số chưa đọc chỉ hiển thị khi có chỉ báo đáng tin cậy từ WhatsApp. Nếu chưa xác định được, dùng **—** theo cơ chế hiện tại; không suy ra số 0 từ việc không thấy badge.

## Phần triển khai cần chạm tới

- `src/shared.ts`: thêm ID `whatsapp`, URL, host và màu nhận diện vào registry nền tảng.
- `src/renderer/shell.ts`, `src/renderer/logos/`: bổ sung logo và nội dung hướng dẫn theo tài khoản đích; tận dụng giao diện chung.
- `src/main/auth-detection.ts`: nhận diện màn hình liên kết và giao diện sau đăng nhập bằng bằng chứng DOM được kiểm chứng; trạng thái không rõ trả về `ready`.
- `src/main/unread-snapshot.ts`: tách nhánh WhatsApp để không rơi vào bộ đọc mặc định của Messenger; chỉ lấy chỉ báo số đã kiểm chứng.
- `src/main/local-accounts.ts`: khai báo WhatsApp không hỗ trợ nhập phiên Chrome; không giả lập xác thực bằng cookie.
- Tái sử dụng catalog, session partition, view registry, chính sách điều hướng và cơ chế lưu phiên hiện có. Catalog cũ tự bổ sung tài khoản mặc định của nền tảng mới mà không thay ID/partition của tài khoản đã lưu.

Đề xuất chỉ cho điều hướng nội bộ tới HTTPS `web.whatsapp.com` ở giai đoạn đầu. Chỉ bổ sung host đăng nhập khác khi quan sát được nhu cầu thực tế. Chính sách này áp dụng cho điều hướng trang; không đồng nghĩa chặn các tài nguyên mạng mà WhatsApp Web cần tải.

## Phạm vi và giới hạn

- Có nhiều tài khoản WhatsApp trong Gom, mỗi tài khoản dùng một partition riêng và chịu các điều kiện liên kết thiết bị của WhatsApp.
- Nội dung trò chuyện và thao tác gửi tin nhắn do giao diện WhatsApp Web xử lý. Gom không lưu bản sao lịch sử chat, mã QR hay thông tin xác thực vào log.
- Không có WhatsApp Business API, tự động gửi tin, bot hoặc đồng bộ phiên từ Chrome trong thay đổi này.
- Chưa cam kết cuộc gọi, camera, micro hoặc độ đầy đủ của badge/thông báo trước khi kiểm tra thực tế trong Electron.
- Không tạo installer, phát hành hay đẩy mã lên GitHub trong phạm vi thiết kế.

## Tiêu chí nghiệm thu khi triển khai

1. WhatsApp có logo trong thư viện, mở được từ tìm kiếm, thêm tài khoản và dùng lại các thao tác tab hiện có.
2. Trang chính thức tải được trong Electron; màn hình liên kết và trạng thái sau liên kết được xác minh thực tế. Việc quét QR do người dùng thực hiện.
3. Hai tài khoản dùng vùng lưu trữ khác nhau; chuyển tab không tạo lại trang; dữ liệu phiên vẫn còn qua lần thoát/mở ứng dụng.
4. Catalog cũ nạp được, tài khoản cũ giữ nguyên ID/partition và tab đã lưu không bị sắp xếp lại.
5. Không nhận diện nhầm QR, trang đang đồng bộ hoặc trang lỗi là đã đăng nhập; chưa đọc không có dữ liệu thì hiển thị **—**.
6. Nhập phiên Chrome cho WhatsApp hiển thị hướng dẫn liên kết trực tiếp và không sửa dữ liệu phiên đích.
7. Kiểm tra typecheck và các test liên quan registry, tài khoản, điều hướng, trạng thái đăng nhập và badge. Kiểm tra giao diện bằng fixture không chứa dữ liệu cá nhân; ghi riêng những gì đã xác minh với WhatsApp thật.

## Nguồn tham khảo

- WhatsApp Web chính thức: https://web.whatsapp.com/
- WhatsApp Help Center, thiết bị liên kết: https://faq.whatsapp.com/378279804439436/
- WhatsApp Help Center, liên kết bằng số điện thoại: https://faq.whatsapp.com/1324084875126592/

Trạng thái: người dùng đã duyệt thiết kế bằng “chốt”; được phép triển khai vào mã ứng dụng.
