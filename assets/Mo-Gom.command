#!/bin/bash
# Gỡ cờ cách ly của macOS khỏi Gom.app rồi mở app.
# Chỉ chạy khi bạn tin cậy nơi tải Gom.
APP="/Applications/Gom.app"

if [ ! -d "$APP" ]; then
  echo "Chưa thấy $APP."
  echo "Hãy kéo Gom.app vào Applications trước, rồi chạy lại file này."
  read -r -p "Nhấn Enter để đóng..."
  exit 1
fi

xattr -dr com.apple.quarantine "$APP"
open "$APP"
