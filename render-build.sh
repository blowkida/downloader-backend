#!/bin/bash
set -e

# Create directories
echo "Creating directories..."
mkdir -p /tmp/bin

# Download yt-dlp
echo "Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/bin/yt-dlp
chmod +x /tmp/bin/yt-dlp

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "/tmp/bin/yt-dlp" ]; then
  echo "yt-dlp downloaded successfully"
  /tmp/bin/yt-dlp --version || echo "Warning: yt-dlp version check failed"
else
  echo "Error: yt-dlp download failed"
  exit 1
fi

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

# Verify FFmpeg installation
echo "Verifying FFmpeg installation..."
if [ -f "/tmp/bin/ffmpeg" ] && [ -f "/tmp/bin/ffprobe" ]; then
  echo "FFmpeg and FFprobe copied successfully"
  /tmp/bin/ffmpeg -version || echo "Warning: ffmpeg version check failed"
  /tmp/bin/ffprobe -version || echo "Warning: ffprobe version check failed"
else
  echo "Error: FFmpeg installation failed"
  exit 1
fi

# Clean up
echo "Cleaning up..."
rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg

# Create a flag file to indicate setup is complete
touch /tmp/bin/setup_complete
echo "PATH=/tmp/bin:$PATH" >> ~/.bashrc
echo "export PATH" >> ~/.bashrc

echo "Build script completed successfully"