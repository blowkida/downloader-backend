#!/bin/bash
set -e

echo "🔧 Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
mv yt-dlp /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed at /opt/render/project/src/yt-dlp"

echo "⬇️ Downloading YouTube cookies from Google Drive..."

FILE_ID="13_F3sWRws8XHFH-SQCmhBDdJNk9cP1gX"

# Install wget if not available
if ! command -v wget &> /dev/null; then
  echo "Installing wget..."
  apt-get update && apt-get install -y wget
fi

# Try to download using wget with direct approach
wget --no-check-certificate --load-cookies /tmp/cookies.txt "https://docs.google.com/uc?export=download&confirm=$(wget --quiet --save-cookies /tmp/cookies.txt --keep-session-cookies --no-check-certificate "https://docs.google.com/uc?export=download&id=${FILE_ID}" -O- | sed -rn 's/.*confirm=([0-9A-Za-z_]+).*/\1\n/p')&id=${FILE_ID}" -O youtube-cookies.txt && rm -rf /tmp/cookies.txt

# Check if download was successful
if [ -f youtube-cookies.txt ] && [ -s youtube-cookies.txt ]; then
  chmod 600 youtube-cookies.txt
  echo "✅ youtube-cookies.txt downloaded successfully using wget method."
  ls -l youtube-cookies.txt
else
  echo "⚠️ wget method failed, trying alternative download method..."
  
  # Alternative method using curl with direct URL
  COOKIES_URL="https://raw.githubusercontent.com/blowkida/youtube-cookies-backup/main/youtube-cookies.txt"
  curl -L "${COOKIES_URL}" -o youtube-cookies.txt
  
  if [ -f youtube-cookies.txt ] && [ -s youtube-cookies.txt ]; then
    chmod 600 youtube-cookies.txt
    echo "✅ youtube-cookies.txt downloaded successfully using alternative method."
    ls -l youtube-cookies.txt
  else
    echo "❌ All download methods failed for youtube-cookies.txt"
    
    # Create a minimal cookies file as last resort
    echo "# Netscape HTTP Cookie File" > youtube-cookies.txt
    echo "# This is a generated file. Do not edit." >> youtube-cookies.txt
    echo "# Basic placeholder for youtube.com cookies" >> youtube-cookies.txt
    echo ".youtube.com	TRUE	/	FALSE	2147483647	LOGIN_INFO	placeholder_value" >> youtube-cookies.txt
    chmod 600 youtube-cookies.txt
    echo "⚠️ Created minimal placeholder cookies file as last resort."
    ls -l youtube-cookies.txt
  fi
fi

echo "📦 Installing npm dependencies..."
npm install

echo "✅ Build script completed successfully."
