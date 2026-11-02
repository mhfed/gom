# Landing page Gom trên GitHub Pages

Source trang nằm trong `website/`, độc lập với app Electron. HTML/CSS/JS và logo đều được phục vụ tĩnh, không cần cài dependency hoặc build. Không có analytics, cookie hay tài nguyên từ CDN. Các cuộc trò chuyện hiển thị trên landing page là nội dung minh họa.

## Xem tại máy

Từ thư mục repository:

```sh
python3 -m http.server 4173 --directory website --bind 127.0.0.1
```

Mở <http://127.0.0.1:4173>. Kiểm tra cả màn hình máy tính và điện thoại; thử menu, tab nền tảng, chat nổi minh họa và FAQ.

## Xuất bản

1. Đưa `website/` và `.github/workflows/pages.yml` lên nhánh `main` của `mhfed/gom`.
2. Trong GitHub repository, mở **Settings → Pages → Build and deployment → Source → GitHub Actions**. Cần người có quyền quản trị repository cho bước này.
3. Workflow **Deploy Gom landing page** tự chạy khi source website thay đổi trên `main`. Nếu vừa bật Pages sau khi đã push, vào **Actions → Deploy Gom landing page → Run workflow**, chọn `main`.
4. Chờ job `deploy` thành công. Lấy URL từ environment `github-pages`; URL mặc định dự kiến là <https://mhfed.github.io/gom/>.

Workflow chỉ upload `website/`, không upload source app, file cài đặt, `outputs/` hoặc dữ liệu tài khoản. Không cần deploy key hoặc token lưu trong repository; workflow dùng quyền Pages và OIDC của GitHub Actions.

Hướng dẫn chính thức: [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Cập nhật nội dung

- `website/index.html`: nội dung, FAQ, thông tin phiên bản và URL bộ cài. Tìm `0.8.3` để cập nhật sau khi xác minh release mới cùng asset Mac/Windows.
- `website/styles.css`: bố cục responsive và màu thương hiệu.
- `website/app.js`: menu điện thoại, tab nền tảng và minh họa chat nổi. Các nút tải, nội dung và FAQ hoạt động khi tắt JavaScript.
- `website/assets/`: logo Gom và logo nền tảng từ source app; xem `providers/SOURCES.md` để biết nguồn.

Tất cả URL asset dùng đường dẫn tương đối nên chạy ở cả `/gom/` và tên miền riêng. Liên kết tải là URL GitHub Releases tuyệt đối. Bộ cài đang được liên kết là **0.8.3**, đã đối chiếu với GitHub Releases ngày 02/11/2026.
