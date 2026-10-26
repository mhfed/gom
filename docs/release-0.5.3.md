# Tin Nhan 0.5.3 — chat riêng theo nền tảng

## Phạm vi

Theo yêu cầu mới, dừng chat thống nhất. Giữ Electron và trang chat chính thức của từng nền tảng. Thanh trên 64px có tab Zalo / Telegram / Messenger, chọn tài khoản cùng nền tảng, thêm tài khoản, chuyển nhanh, sáng/tối, cài đặt và menu thao tác trang native. Bỏ sidebar app để dành chiều rộng cho nội dung chat.

Tab nhớ tài khoản cuối, đồng bộ khi mở từ menu/thông báo/command palette. Chuyển tab không tạo lại hoặc reload trang. Phím mũi tên giữ focus trên thanh tab; bấm chuột chuyển tab đưa focus về trang chat. Hộp thêm/sửa tài khoản chặn phím tắt đổi nền tảng để nội dung đang nhập không bị che.

Không thay userData (`TinNhanDesktop`), bundle ID hoặc partition. Giữ tối ưu CPU và workaround Secure Input của 0.5.2. Bản nháp trong trang được giữ khi chuyển tab/ẩn cửa sổ; việc phục hồi bản nháp sau khi thoát app phụ thuộc nền tảng. Các connector nghiên cứu không được tích hợp; mã nguồn nghiên cứu/tài liệu/fixture không nằm trong runtime đóng gói.

## Kiểm chứng

- Typecheck và 90/90 unit tests PASS.
- Native tabs: 11/11 ca PASS; giữ nguyên 4 webContents IDs, document tokens, số request, bản nháp, vị trí caret. Layout ở 940/1280, ảnh sáng/tối ở 1024, nền tảng rỗng, focus, modal, cập nhật trạng thái không đổi.
- Renderer performance PASS: không có DOM mutation khi trạng thái không đổi, không sửa tab không liên quan; cập nhật unread/theme/account/settings và giữ nội dung đang nhập.
- Command focus PASS: trả focus về trang chat, không mở chồng command palette lên editor.
- Multi-account PASS: dữ liệu phiên kiểu cũ, sáu tài khoản cách ly, đổi tab/tài khoản, nhập Messenger đúng đích, thông báo/unread, archive/restore, lưu nhận diện/preferences qua mở lại.
- Desktop PASS: quyền/frame policy, thông báo, phím tắt, ẩn/hiện, offline/wake, phục hồi trang lỗi và giữ draft/view.
- Persistence write/read PASS: cookie, localStorage, IndexedDB trong ba partition qua hai tiến trình.
- Window lifecycle PASS: đóng chỉ ẩn, mở lại cùng view, thoát kết thúc tiến trình.

Tất cả dùng hồ sơ tạm và trang HTTPS giả; không đăng nhập tài khoản thật hoặc gửi tin. Ảnh trong outputs/native-tabs là ghép ảnh của hai surface thật (shell + trang fixture), có ghi rõ dữ liệu giả; không phải giao diện chat thống nhất được phát hành.

- Native IME: 37/37 ca PASS trong `outputs/ime-0.5.3/result.json`. Ô mật khẩu đang focus được bảo vệ; cửa sổ mất focus/ẩn/thu nhỏ, trang ẩn, shadow root, iframe khác origin và popup đều nhả Secure Input đúng. Cookie/storage/bản nháp/view IDs được giữ. Đây là kiểm tra cơ chế gây chặn EVKey, chưa thay thế gõ Telex thật với EVKey của người dùng.

Đo hồi quy CPU nền: chạy tuần tự 0.5.2 trích từ ASAR đã phát hành và build 0.5.3, cùng ba trang đăng nhập giả có hoạt ảnh, warmup 32 giây và mẫu 20,4 giây, một lượt mỗi bản. Đây là smoke test hiệu năng, không phải thống kê hay dự báo nền tảng thật. Kết quả trong `outputs/performance-0.5.3/comparison.json`:

| Chỉ số trong 20,4 giây khi ẩn | 0.5.2 | 0.5.3 |
| --- | ---: | ---: |
| CPU cộng các tiến trình | 0,02245% | 0,02146% |
| Working set cộng các tiến trình | 635,56 MiB | 623,72 MiB |
| State IPC / DOM mutation / frame hoạt ảnh | 0 / 0 / 0 | 0 / 0 / 0 |
| Page probes / idle wakeups mỗi giây | 15 / 4 | 15 / 4 |

Cả hai giữ nguyên dữ liệu phiên, draft và view; hoạt ảnh tiếp tục khi hiện lại. Working set có thể đếm trùng bộ nhớ dùng chung. Một mẫu ngắn chưa chứng minh mức cải thiện CPU/RAM; kết quả cho thấy lượng việc nền đo được không tăng trong fixture. Thời gian probe có cả scheduling/IPC, không dùng làm CPU time.

## Bản cài

- ZIP: `outputs/TinNhan-macOS-arm64-0.5.3.zip` (119,883,337 bytes).
- App giải nén: `outputs/TinNhan-0.5.3/Tin Nhan.app`.
- SHA-256: `9501d65a0b5631479a3db59f279d808851ecee2c7808d9fecead70be7914db6b`; checksum file `outputs/SHA256SUMS-0.5.3.txt`.
- `npm run make` PASS; ZIP integrity, codesign deep/strict, arm64, Info.plist 0.5.3 và bundle ID cũ đều PASS.
- Sáu file runtime trong ASAR khớp SHA-256 của build đã chạy kiểm thử/benchmark. Package inventory không có src/tests/scripts/docs/outputs/node_modules/HANDOFF/README.
- Bản cá nhân ký ad-hoc, chưa có Developer ID/notarization. Chưa cài đè, chưa mở app đóng gói bằng profile cá nhân, chưa commit/push/phát hành public.

Để nâng cấp: lưu các bản nháp quan trọng trong nền tảng trước khi thoát bản cũ bằng ⌘Q, rồi thay `Tin Nhan.app`. Giữ nguyên dữ liệu ứng dụng. Khôi phục draft sau khi thoát phụ thuộc nền tảng; chuyển tab và ẩn cửa sổ trong phiên chạy đã được kiểm chứng giữ draft.
