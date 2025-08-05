#!/bin/bash
set -e

echo "🔧 Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
mv yt-dlp /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed at /opt/render/project/src/yt-dlp"

echo "🔍 Checking for youtube-cookies.txt..."
if [ -f "youtube-cookies.txt" ]; then
  chmod 600 youtube-cookies.txt
  echo "✅ youtube-cookies.txt found and permissions set:"
  ls -l youtube-cookies.txt
else
  echo "⚠️ youtube-cookies.txt not found. Using manually uploaded file."
fi

echo "📦 Installing npm dependencies..."
npm install

echo "✅ Build script completed successfully."
