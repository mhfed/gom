# Kiểm chứng kết nối WhatsApp Web

Ngày: 2026-11-02. Phạm vi: triển khai thiết kế WhatsApp Web đã được người dùng duyệt; chưa đóng gói installer hay phát hành.

## Thay đổi

- WhatsApp là nền tảng có sẵn, mở `https://web.whatsapp.com/`, logo đóng gói cục bộ; xuất hiện qua các thành phần tab, thư viện và tài khoản đang có.
- Mỗi tài khoản dùng partition riêng. Catalog cũ bổ sung tài khoản WhatsApp mặc định, giữ nguyên ID, partition và thứ tự tab đã lưu.
- Nhận diện màn hình QR và liên kết bằng số điện thoại; nhận diện cấu trúc giao diện đã đăng nhập theo DOM, không quét nội dung chat. Cấu trúc chưa rõ trả về `ready`.
- Badge WhatsApp chỉ nhận bộ đếm có dạng `(N) WhatsApp` khi có cấu trúc giao diện đã đăng nhập; thiếu dữ liệu vẫn là **—**.
- Chọn tài khoản WhatsApp trong nhập phiên Chrome lập tức hiện hướng dẫn liên kết bằng điện thoại và vô hiệu hóa nút nhập. Main process cũng từ chối yêu cầu nhập WhatsApp trước khi đọc hoặc thay đổi phiên.
- Sửa giới hạn catalog để các tài khoản mặc định không chiếm dung lượng tài khoản người dùng đã được phép lưu trước đó: tối đa 104 tài khoản bổ sung, cộng các tài khoản nền tảng mặc định. Có kiểm thử lặp nạp/lưu ở giới hạn để việc bổ sung nền tảng không làm hồ sơ cũ mất khả năng lưu.

## Kết quả

- Baseline trước khi sửa: `npm test` — **255/255 đạt**.
- Quan sát kiểm thử thất bại trước triển khai cho registry, migration, trạng thái, badge và hướng dẫn nhập phiên; các kiểm thử sau sửa đạt.
- `npm run typecheck` — **đạt**.
- `npm test` sau sửa cuối — **266/266 đạt**, không thất bại hoặc bỏ qua.
- `npm run build` sau sửa cuối — **đạt**; đây là biên dịch để chạy kiểm thử, không phải installer/release.
- `git diff --check` — **đạt**.
- `node scripts/whatsapp-check.mjs` — **đạt** trong Electron bằng hồ sơ tạm, tất cả trang dịch vụ được thay bằng fixture cục bộ. Có kiểm tra:
  - Thứ tự tab/ghim đã lưu giữ nguyên; tìm được WhatsApp và logo cục bộ tải thành công.
  - Màn hình liên kết trả về `needs-login`; fixture sau đăng nhập trả về `authenticated` và badge tiêu đề được cập nhật.
  - Hai tài khoản dùng vùng lưu trữ khác nhau; chuyển tab giữ cùng tài liệu và bản nháp.
  - Đổi tài khoản đích cập nhật ngay hướng dẫn và nút nhập phiên. Gọi nhập WhatsApp trực tiếp trả `unsupported-session`, dữ liệu phiên đích giữ nguyên.
  - Sau thoát hoàn toàn và mở lại, hai giá trị lưu trữ thử nghiệm còn riêng biệt; hướng dẫn liên kết vẫn đúng khi không có profile Chrome.
  - Không có lỗi JavaScript ở shell hoặc mở URL ngoài dự kiến.

Ảnh kiểm chứng đã xem: `outputs/whatsapp-web/catalog.png`, `outputs/whatsapp-web/linking-fixture.png`. Ảnh thứ hai là giao diện fixture được ghi rõ trong hình, không phải giao diện WhatsApp thật. Vùng WebContentsView được chụp riêng rồi ghép đúng vị trí với shell do ảnh chụp shell của Electron không chứa trang nhúng. Báo cáo fixture: `outputs/whatsapp-web/report.json`.

## Rà soát độc lập

Một reviewer chỉ đọc mã đã rà các thay đổi WhatsApp và phát hiện lỗi giới hạn catalog: hồ sơ hợp lệ 104 tài khoản có thể thành 105 sau khi thêm nền tảng, khiến lần lưu tiếp theo thất bại. Đã tái hiện bằng hai kiểm thử thất bại, sửa cách tính dung lượng và chạy lại toàn bộ suite: **266/266 đạt**. Không có phát hiện khác cần sửa hoặc mục nhỏ hoãn lại.

Quyết định triển khai: giữ nguyên dung lượng 104 tài khoản bổ sung mà validator cũ có thể nhận, tính riêng tài khoản nền tảng mặc định để các lần bổ sung nền tảng sau không tái tạo lỗi. Nếu thay đổi giới hạn này không phù hợp định hướng sản phẩm, có thể điều chỉnh sau; hiện không làm hồ sơ cũ mất dữ liệu hoặc bị từ chối vì WhatsApp.

## Kiểm tra trang thật và giới hạn còn lại

- Trang WhatsApp Web chính thức đã tải được trong trình duyệt. Quan sát trực tiếp canvas `role="img"` có nhãn `Scan this QR code to link a device`, checkbox `#auto-logout-toggle`, nút đổi sang nhập số điện thoại và nút `Log in with QR code`.
- Không lưu mã QR, số điện thoại hoặc dữ liệu xác thực từ trang thật.
- Chưa liên kết tài khoản WhatsApp thật. Cấu trúc sau đăng nhập (`#side`, header, `#pane-side`), badge, lưu phiên xác thực thật, gửi/nhận, thông báo và cuộc gọi chưa được xác minh trực tiếp với WhatsApp trong Electron. Kiểm thử fixture chỉ chứng minh logic tích hợp; không được coi là bằng chứng các tính năng đó đã hoạt động trên tài khoản thật.
- Lần mở trang thật đầu tiên hết thời gian ở cổng cấp quyền; lần thử lại đã thành công. Kiểm thử Electron cần chạy ngoài sandbox hạn chế vì sandbox không cho khởi chạy tiến trình GUI; chỉ dùng hồ sơ tạm và trang giả lập.
- Các thay đổi README/website và tài liệu khác đã có từ trước được giữ nguyên. Không commit, push, cập nhật ứng dụng đã cài hoặc phát hành trong công việc này.
