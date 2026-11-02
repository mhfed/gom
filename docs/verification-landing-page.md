# Kiểm chứng landing page Gom — 02/11/2026

## Phạm vi

`website/`, `.github/workflows/pages.yml` và tài liệu liên quan. Không thay đổi runtime, dependency hoặc bộ cài Electron.

## Kết quả

Thiết kế cuối sau phản hồi ngày 02/11: giữ Helvetica Neue/Arial; bổ sung hero chia cột, cửa sổ Gom trên nền teal, minh họa chuyển tài khoản và chat nổi cạnh tài liệu, ba tiện ích cùng vùng tải xuống. Giữ nguyên workflow Pages và URL tải đã kiểm chứng.

- Trang cục bộ trả HTTP 200. JavaScript qua `node --check`; HTML/CSS/JS, workflow và tài liệu triển khai qua kiểm tra Prettier.
- Đối chiếu 25 tham chiếu asset, toàn bộ anchor nội bộ, một H1, bốn tab có tên truy cập được và bốn liên kết bộ cài 0.8.3.
- Đối chiếu GitHub Releases: phiên bản ổn định mới nhất là `v0.8.3`, có đúng asset `Gom-macOS-arm64-0.8.3.dmg` và `Gom-win32-x64-0.8.3-Setup.exe`.
- Browser QA tại 320, 375, 390, 600, 768, 1024, 1440 px: không tràn ngang, không thiếu ảnh.
- Chuyển nền tảng bằng click và bàn phím mũi tên/End; nội dung, tên tab, ARIA selection và màu minh họa được cập nhật.
- Mở chat nổi mẫu, đóng bằng Escape và trả focus về nút mở; trạng thái `aria-expanded` đúng.
- Menu điện thoại mở và tự đóng sau khi chọn liên kết. Liên kết Không gian kín/cài đặt tự mở đúng FAQ.
- Đã tái hiện rồi sửa trường hợp đóng FAQ và bấm lại cùng liên kết khi hash không đổi; FAQ được mở lại đúng.
- Bản HTML tạm không có script: điều hướng vẫn hiển thị, preview tĩnh, liên kết tải có sẵn, FAQ mở được bằng disclosure gốc. Đã gỡ file QA tạm sau kiểm tra.
- Không ghi nhận lỗi/cảnh báo console trong kiểm tra tương tác.
- Thiết kế mới đã kiểm tra lại trên bảy kích thước nêu trên, bao gồm menu, tab bàn phím, FAQ, bản không script và nút chat nổi ở phần tính năng. Đóng demo trả focus về đúng nút đã mở nó.
- Chữ phụ của vùng tải xuống đạt tương phản 4,90:1–5,03:1; liên kết/chú thích tiện ích đạt 5,57:1 sau khi tăng độ đậm.
- Workflow chỉ upload `website/`, chỉ deploy từ `main`, dùng `pages: write`, `id-token: write` và environment `github-pages`.

## Giới hạn xuất bản

Repository `mhfed/gom` báo `has_pages: false`. Tài khoản GitHub kết nối có `push: true` nhưng `admin: false`, `maintain: false`. GET/POST endpoint Pages trả 404. Cần người quản trị bật **Settings → Pages → Source: GitHub Actions**; sau đó merge landing page lên `main` và chạy workflow. Chưa xác nhận URL công khai hoạt động.

Source được chuẩn bị từ bản `main` mới nhất trong checkout tạm để không đưa các commit đang phát triển của nhánh local vào pull request.
