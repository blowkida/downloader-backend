#!/bin/bash
set -e

echo "🔧 Starting render-build.sh..."

# Define binary install location
BIN_DIR="$HOME/bin"

# Create a safe binary directory in the user's home
echo "📁 Creating $BIN_DIR..."
mkdir -p "$BIN_DIR"
chmod 755 "$BIN_DIR"

# Download the latest yt-dlp binary from GitHub
echo "⬇️ Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"

# Make it executable
chmod +x "$BIN_DIR/yt-dlp"
echo "✅ yt-dlp downloaded and made executable."

# Add the bin directory to PATH
export PATH="$BIN_DIR:$PATH"
echo "export PATH=$BIN_DIR:$PATH" >> ~/.bashrc

# Create temp directory
echo "📁 Creating temp directory..."
mkdir -p "./temp"
chmod 755 "./temp"

# Verify installations
echo "🔍 Verifying installations..."
which yt-dlp || echo "⚠️ yt-dlp not found in PATH"

echo "✅ Build script completed successfully."
