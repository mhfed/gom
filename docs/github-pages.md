# Gom — GitHub Pages cá nhân

Website: <https://vidongls.github.io/gom/>. Repository: <https://github.com/vidongls/gom>, fork từ `mhfed/gom`.

## Cách xuất bản

- Mã nguồn landing page nằm trong `website/` trên nhánh `main`.
- Nhánh `gh-pages` chỉ chứa nội dung của `website/`, với `index.html` ở thư mục gốc và `.nojekyll`.
- Settings → Pages dùng **Deploy from a branch → gh-pages → /(root)**.
- GitHub tự build/deploy khi nhánh `gh-pages` được cập nhật. Workflow Pages tự viết hiện được tắt vì tài khoản đang bị khóa chạy Actions do billing; luồng Pages tích hợp vẫn chạy được.

Sau khi sửa website, commit và đẩy `main`, rồi xuất bản từ checkout của fork:

```sh
git push origin main
git subtree push --prefix=website origin gh-pages
```

Kiểm tra workflow **pages build and deployment** trong [GitHub Actions](https://github.com/vidongls/gom/actions). Không sửa trực tiếp nhánh `gh-pages` nếu vẫn dùng cách xuất bản này.

## Xem tại máy

Từ thư mục repository:

```sh
python3 -m http.server 4173 --directory website --bind 127.0.0.1
```

Mở <http://127.0.0.1:4173>.

## Nội dung

`website/index.html`, `website/styles.css` và `website/app.js` chứa trang tĩnh, không có dependency hoặc CDN. Các cuộc trò chuyện là minh họa. URL canonical và Open Graph trỏ về website cá nhân; nút tải bộ cài tiếp tục trỏ tới release thật của dự án gốc `mhfed/gom`.

Hướng dẫn chính thức: [Configuring a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
