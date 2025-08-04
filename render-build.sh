#!/bin/bash
set -e

# Create directories
echo "Creating directories..."
mkdir -p /tmp/bin

# Download yt-dlp
echo "Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/bin/yt-dlp
chmod +x /tmp/bin/yt-dlp

# Download FFmpeg
echo "Downloading FFmpeg..."
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz

# Extract FFmpeg
echo "Extracting FFmpeg..."
mkdir -p /tmp/ffmpeg
tar xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1
cp /tmp/ffmpeg/ffmpeg /tmp/bin/
cp /tmp/ffmpeg/ffprobe /tmp/bin/
chmod +x /tmp/bin/ffmpeg
chmod +x /tmp/bin/ffprobe

# Clean up
echo "Cleaning up..."
rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg

# Create a flag file to indicate setup is complete
touch /tmp/bin/setup_complete

echo "Build script completed"