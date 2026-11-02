# Gom — GitHub Pages cá nhân

Website: <https://vidongls.github.io/gom/>. Repository: <https://github.com/vidongls/gom>, fork từ `mhfed/gom`.

## Cách xuất bản

- Mã nguồn landing page nằm trong `website/` trên nhánh `main`.
- Nhánh `gh-pages` chỉ chứa nội dung của `website/`, với `index.html` ở thư mục gốc và `.nojekyll`.
- Settings → Pages dùng **Deploy from a branch → gh-pages → /(root)**.
- GitHub tự build và deploy khi nhánh `gh-pages` được cập nhật.
- Workflow Pages Actions tự viết đã tắt do giới hạn billing; Pages tích hợp của GitHub vẫn deploy được từ nhánh `gh-pages`.

Sau khi sửa landing page và đẩy `main`, xuất bản lại nội dung từ checkout của fork:

```sh
git subtree push --prefix=website origin gh-pages
```

Kiểm tra workflow **pages build and deployment** trong [GitHub Actions](https://github.com/vidongls/gom/actions). Không sửa trực tiếp nhánh `gh-pages` nếu vẫn dùng cách xuất bản này.

## Xem tại máy

```sh
python3 -m http.server 4173 --directory website --bind 127.0.0.1
```

Mở <http://127.0.0.1:4173>.

## Nội dung

`website/index.html`, `website/styles.css` và `website/app.js` tạo trang tĩnh, không có dependency hoặc CDN. Các cuộc trò chuyện là minh họa. URL canonical và Open Graph trỏ về website cá nhân; nút tải, phiên bản và tài liệu trỏ đến fork `vidongls/gom`.

- `website/index.html`: nội dung, FAQ, thông tin phiên bản và liên kết tải.
- `website/styles.css`: bố cục responsive và màu thương hiệu.
- `website/app.js`: menu điện thoại, tab nền tảng và minh họa chat nổi.
- `website/assets/`: logo Gom và logo nền tảng từ source app; xem `providers/SOURCES.md` để biết nguồn.

Hướng dẫn chính thức: [Configuring a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
