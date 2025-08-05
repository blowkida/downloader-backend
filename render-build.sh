#!/bin/bash
set -e

echo "🔧 Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
mv yt-dlp /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed at /opt/render/project/src/yt-dlp"

echo "⬇️ Downloading cookies file from Google Drive..."
# Replace the file ID with your file's actual ID
curl -L -o youtube-cookies.txt "https://drive.google.com/uc?export=download&id=13_F3sWRws8XHFH-SQCmhBDdJNk9cP1gX"
chmod 600 youtube-cookies.txt

echo "✅ youtube-cookies.txt downloaded:"
ls -l youtube-cookies.txt

echo "📦 Installing npm dependencies..."
npm install

echo "✅ Build script completed successfully."
