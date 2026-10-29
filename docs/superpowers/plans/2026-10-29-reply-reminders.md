# Reply Reminders Implementation Plan

**Goal:** Add manual account-bound reply reminders with notes, due times and privacy-safe delivery.

**Architecture:** Encrypted atomic ReminderStore, main-process ReminderService authorization/scheduling, renderer modal and toolbar badge. Existing native pages remain unchanged.

**Spec:** `docs/superpowers/specs/2026-10-29-reply-reminders-design.md`

## Tasks

- [ ] Capture RED for absent reminder API and store behavior.
- [ ] Implement encrypted durable store with serialized claim/release, add/snooze/complete/remove and fail-closed recovery tests.
- [ ] Implement main service and scoped state/IPC, native notifications, lifecycle and account changes.
- [ ] Implement modal, quick/custom time, pending/done lists, safe surface and transient UI scrubbing.
- [ ] Run typecheck, full unit suite, reminder Electron fixture and existing private/floating regressions.
- [ ] Independent review; fix findings, save user guide and validation evidence.

## Review focus

No private notes/counts/IDs across spaces; no private native alerts; account membership/archival while native alert exists; claim during privacy change; corrupt/encryption failures preserve disk; restart overdue delivery without duplicates; snooze/done/delete clear existing alert; local time and invalid dates; modal/floating interaction; app quit waits for pending writes.

## Tạm giữ theo yêu cầu người dùng

Phần dưới lưu lịch sử lần tạm dừng. Người dùng đã yêu cầu tiếp tục trên nền 0.8.1; tiến độ hiện tại ở [kế hoạch hoàn thiện](2026-10-29-complete-reply-reminders.md) và [biên bản kiểm chứng](../../verification-reply-reminders.md).

Người dùng chưa muốn build/cài nhắc việc và chuyển ưu tiên sang sửa chat nổi (reload lúc tách popup, bong bóng còn 60%). Giữ mã nguồn trên nhánh `codex/reply-reminders`, chưa triển khai vào bản cài.

- Typecheck và 198 unit test đã đạt. Store có 14 test; service/projection có thêm các kiểm tra quyền và race.
- UI QA 400/940px đạt. Smoke reminder mới đạt 9 nhóm; 3 nhóm claim/privacy race, tài khoản đã gỡ và file hỏng chưa hoàn tất do tạm dừng.
- Hai P2 cần xử lý trước khi giao: thêm đổi giờ tùy chỉnh cho nhắc việc đã tạo; giữ hoặc chuẩn hóa dấu xuống dòng/tab trong ghi chú để không nối từ.
- Chạy lại build và toàn bộ smoke sau khi tiếp tục, kể cả bản vá đóng/mở modal cuối cùng. Không coi nhắc việc đã hoàn tất hoặc đã được cài.

## Hoàn thiện sau khi tiếp tục

Mã nguồn đã hoàn thiện trên `codex/complete-reply-reminders`, nền 0.8.1. Hai P2 nêu trong lịch sử đã sửa; thêm guard cho mọi thao tác, async safeStorage, dung lượng dự phòng và hồi quy bề mặt Khay/chat nổi. Typecheck/build, 248 unit và Electron nhắc việc 15, tab 16, Không gian kín 17, chat nổi 12, Khay 10 đều đạt. Chi tiết và giới hạn ở [biên bản kiểm chứng](../../verification-reply-reminders.md). Không phát hành hay cài bản mới trong lượt hoàn thiện này.
