#!/usr/bin/env bash

# Create temp binary directory
mkdir -p /tmp/bin

# Download yt-dlp
echo "🔽 Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/bin/yt-dlp
chmod +x /tmp/bin/yt-dlp
echo "✅ yt-dlp installed at /tmp/bin/yt-dlp"

# Download static ffmpeg build
echo "🔽 Downloading ffmpeg..."
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz
tar -xf /tmp/ffmpeg.tar.xz -C /tmp/
mv /tmp/ffmpeg-*-amd64-static/ffmpeg /tmp/bin/ffmpeg
chmod +x /tmp/bin/ffmpeg
echo "✅ ffmpeg installed at /tmp/bin/ffmpeg"

# Export paths (so child_process or yt-dlp-exec can use them)
export PATH="/tmp/bin:$PATH"
