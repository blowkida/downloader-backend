#!/usr/bin/env bash

#!/usr/bin/env bash

# Update packages
apt-get update

# Install ffmpeg and curl
apt-get install -y curl ffmpeg

# Install yt-dlp globally
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp

# Make yt-dlp executable
chmod a+rx /usr/local/bin/yt-dlp

# Confirm versions
yt-dlp --version
ffmpeg -version

echo "✅ yt-dlp and ffmpeg installed globally"
