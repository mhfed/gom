# Gom — Cloudflare Pages

Website: https://gom-df6.pages.dev/. Repository: https://github.com/vidongls/gom, fork từ mhfed/gom.

## Xuất bản

- Mã nguồn landing page nằm trong thư mục website/.
- Cloudflare Pages project: gom. Production branch: main.
- Project dùng Direct Upload qua Wrangler; không cần build riêng.
- Đẩy bản production hiện tại bằng lệnh:

    npm run deploy:website

- Tạo preview từ nhánh khác bằng lệnh:

    npx wrangler pages deploy ./website --project-name=gom --branch=preview

- Xem các lần deploy bằng lệnh:

    npx wrangler pages deployment list --project-name=gom

Project Direct Upload hiện tại không thể chuyển sang Git integration. Nếu sau này cần deploy tự động khi có commit, tạo project Pages mới có Git integration rồi chuyển domain sang project đó.

Hướng dẫn chính thức: https://developers.cloudflare.com/pages/get-started/direct-upload/.

## Xem tại máy

    python3 -m http.server 4173 --directory website --bind 127.0.0.1

Mở http://127.0.0.1:4173.

## Nội dung

website/index.html, website/styles.css và website/app.js tạo trang tĩnh, không có dependency hoặc CDN. Các cuộc trò chuyện là minh họa. URL canonical và Open Graph trỏ về Cloudflare Pages; nút tải, phiên bản và tài liệu trỏ đến fork vidongls/gom.

- website/index.html: nội dung, FAQ, thông tin phiên bản và liên kết tải.
- website/styles.css: bố cục responsive và màu thương hiệu.
- website/app.js: menu điện thoại, tab nền tảng và minh họa chat nổi.
- website/assets/: logo Gom và logo nền tảng từ source app; xem providers/SOURCES.md để biết nguồn.
