#!/bin/bash
set -e

echo "🔧 Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
mv yt-dlp /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed at /opt/render/project/src/yt-dlp"

echo "⬇️ Downloading YouTube cookies from Google Drive..."

FILE_ID="13_F3sWRws8XHFH-SQCmhBDdJNk9cP1gX"

curl -c ./cookie -s -L "https://drive.google.com/uc?export=download&id=${FILE_ID}" > temp.html \
&& curl -Lb ./cookie -s -L "$(cat temp.html | grep -o 'confirm=[^&]*&amp;id=[^"]*' | sed 's/&amp;/\&/g' | head -n 1 | sed 's/^/https:\/\/drive.google.com\/uc?export=download\&/')" -o youtube-cookies.txt

if [ -f youtube-cookies.txt ]; then
  chmod 600 youtube-cookies.txt
  echo "✅ youtube-cookies.txt downloaded successfully."
  ls -l youtube-cookies.txt
else
  echo "❌ Failed to download youtube-cookies.txt"
  exit 1
fi

echo "📦 Installing npm dependencies..."
npm install

echo "✅ Build script completed successfully."
