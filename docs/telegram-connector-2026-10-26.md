# Telegram: kiểm tra khả thi TDLib trên Electron

Ngày kiểm tra: 2026-10-26. Phạm vi: native library và vòng đời client chưa đăng nhập; **chưa phải connector production**.

## Kết quả

Đã chạy TDLib trong `utilityProcess` của Electron **45.0.0**, Node **24.22.0**, Chromium **156.0.8078.48**, trên macOS **15.4.1 arm64**. Hai client cùng một utility process đều trả về `authorizationStateWaitTdlibParameters`, sau đó nhận `authorizationStateClosing` và `authorizationStateClosed`; worker và Electron thoát mã 0.

Harness không import app production, dùng `appData`, `userData`, `sessionData`, `logs` và thư mục làm việc tạm. Không cung cấp API credentials, không gọi `setTdlibParameters`, không đăng nhập, không đọc tài khoản/hội thoại, không gửi tin nhắn. Không đọc hay sửa partition hiện có. Đây không phải phép đo lưu lượng mạng, hiệu năng đồng bộ hoặc mức dùng RAM khi đã đăng nhập.

Tệp bằng chứng: [telegram-native-evidence.json](../scripts/research/telegram-native-evidence.json). Tệp này ghi phiên bản runtime, SHA-256 native binaries, npm integrity, các request đã gọi, các state nhận được và exit code.

## Dependency đã chốt

| Thành phần | Phiên bản / bằng chứng |
| --- | --- |
| `tdl` | `8.1.0`; MIT; Node-API binding cộng đồng |
| `prebuilt-tdlib` | `0.1008069.0`; metadata/wrapper MIT |
| TDLib | `1.8.69`; commit `027780b87a66a2a0e69db644e812362bb300f1e1`; BSL-1.0 |
| `@prebuilt-tdlib/darwin-arm64` | `0.1008069.0`; native library arm64 |

Phiên bản và integrity được đọc từ npm registry bằng `npm view`, sau đó cài vào `/private/tmp/tin-nhan-telegram-native-osbTBK` với `--ignore-scripts --save-exact --no-audit --no-fund`. Không sửa `package.json` hoặc lockfile của dự án. Không chạy lifecycle install scripts hoặc rebuild addon; prebuilt addon đã tải chạy được trong phép thử này.

`file` xác nhận cả `tdl.node` và `libtdjson.dylib` là Mach-O arm64. `otool` xác nhận TDLib có deployment target **macOS 14.0**; các dynamic dependency chỉ gồm hệ thống `libc++` và `libSystem` ngoài install name của chính thư viện. Hai native file có tổng dung lượng **33,038,568 byte**, chưa tính JavaScript, metadata hoặc nén bộ cài. Dung lượng này không phải RAM runtime.

Nguồn: [tdl](https://github.com/eilvelia/tdl), [prebuilt-tdlib](https://raw.githubusercontent.com/eilvelia/tdl/develop/packages/prebuilt-tdlib/README.md), [TDLib](https://github.com/tdlib/td). TDLib schema không bảo đảm tương thích ngược; cần pin library và TypeScript types cùng phiên bản. Tác giả binding ghi arm64 prebuild chưa được CI của họ kiểm tra; phép thử cục bộ này chỉ bổ sung bằng chứng cho máy/runtime nêu trên.

## Chạy lại

Chỉ dùng thư mục dependency tạm; script không tự tải package.

```sh
TELEGRAM_SMOKE_DEPS=$(mktemp -d /private/tmp/tin-nhan-telegram-native-XXXXXX)
npm install --prefix "$TELEGRAM_SMOKE_DEPS" --ignore-scripts --save-exact --no-audit --no-fund tdl@8.1.0 prebuilt-tdlib@0.1008069.0
node scripts/research/telegram-native-smoke.mjs --deps "$TELEGRAM_SMOKE_DEPS"
```

Các tệp `telegram-native-main.cjs` và `telegram-native-worker.cjs` chỉ được launcher gọi. Request nghiệp vụ được giới hạn ở `getAuthorizationState`, `getOption(version)` và `close`. Binding tự thiết lập mức log khi load library; không cấu hình Telegram client parameters.

Trong sandbox hiện tại, Electron abort trước khi chạy harness; cần quyền chạy native process bằng cơ chế approval của môi trường. Lần chạy có quyền đã thành công. Cấu hình `allowLoadingUnsignedLibraries` không được bật.

Vòng đời cần chú ý: không có `process.parentPort.close()` trong Electron. Đóng hết TDLib clients chưa làm utility process tự thoát trong phép thử. Harness chờ tất cả `authorizationStateClosed`, gửi báo cáo, nhận acknowledgement từ main rồi mới gọi `process.exit(0)`. Production cần lifecycle tương đương, deadline cho shutdown và xử lý child crash. Không dùng kill thay cho TDLib close trong luồng thoát bình thường. [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process), [TDLib JSON interface](https://core.telegram.org/tdlib/docs/td__json__client_8h.html)

## Phần chưa được xác minh

- Đăng nhập QR/số điện thoại, code/email/2FA, lưu phiên qua restart và nhiều tài khoản thật.
- Lấy danh sách hội thoại/lịch sử, incoming updates, gửi/nhận, trạng thái lỗi, media, unread/read receipt và draft đồng bộ.
- Bản ASAR đã đóng gói/ký, notarization, hardened runtime hoặc các phiên bản macOS khác. Dev smoke không chứng minh native binaries sẽ có mặt đúng vị trí và load được trong bản cài.
- Hiệu năng với cùng tài khoản thật và khối lượng hội thoại so với web app hiện có.

`forge.config.cjs` hiện bỏ toàn bộ `node_modules`, còn build chỉ externalize `electron`. Khi tích hợp cần worker entry riêng, chọn runtime dependency/native resource sẽ đưa vào app, externalize binding phù hợp, unpack native files, ký và chạy lại smoke trên artifact đã đóng gói. Không nên nới library validation chỉ để che lỗi packaging.

## Bước tiếp theo và bảo toàn dữ liệu

1. Xây adapter typed và IPC tối thiểu; nhận updates có thứ tự trong một connector process, mỗi tài khoản một TDLib client và database riêng. Phân trang dữ liệu, chỉ tải media theo nhu cầu. Đo tài nguyên sau khi có phiên thật.
2. Dùng `api_id` và `api_hash` riêng của Tin Nhan từ [API development tools](https://core.telegram.org/api/obtaining_api_id). Nhập cấu hình cục bộ, không đưa secrets vào chat, logs hoặc source control. Sau đó người dùng tự thực hiện đăng nhập theo [TDLib authorization state](https://core.telegram.org/tdlib/getting-started), có thể dùng [QR](https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1request_qr_code_authentication.html).
3. Giữ nguyên Chromium/Web K partitions hiện có. Chưa xác minh được API chính thức nhập trực tiếp phiên Web K vào TDLib; coi connector là phiên mới. Không tự di chuyển hay xóa dữ liệu cũ.
4. TDLib có [draft API](https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1set_chat_draft_message.html), nhưng chưa chứng minh bản nháp Web K chưa đồng bộ sẽ chuyển sang. Lưu draft mới theo account/chat/topic, tránh ghi đè draft server khi khởi động, kiểm tra reopen/reconnect trước khi chuyển người dùng sang giao diện mới.
5. Trước phát hành rộng, đánh giá đầy đủ hành vi cơ bản và [Telegram API terms](https://core.telegram.org/api/terms), gồm trạng thái đọc/online, nội dung tự hủy và sponsored messages nếu hiển thị channels.

Kết luận của phép thử chỉ là: **có đường native khả thi trên Electron 45 arm64 với hai package đã pin; việc xây connector và kiểm tra dữ liệu thật vẫn còn phía trước**.
