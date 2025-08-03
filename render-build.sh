#!/usr/bin/env bash

# Install yt-dlp globally on Render
apt-get update && apt-get install -y curl

# Download latest yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp

# Make it executable
chmod a+rx /usr/local/bin/yt-dlp

echo "✅ yt-dlp installed globally"
