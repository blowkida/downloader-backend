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

# Ensure yt-dlp-exec can find the binary
echo "🔗 Linking yt-dlp binary into yt-dlp-exec expected path..."
mkdir -p ./node_modules/yt-dlp-exec/bin
cp "$BIN_DIR/yt-dlp" ./node_modules/yt-dlp-exec/bin/yt-dlp
chmod +x ./node_modules/yt-dlp-exec/bin/yt-dlp
echo "✅ Linked yt-dlp to ./node_modules/yt-dlp-exec/bin/yt-dlp"

# Optional: show version to verify success
echo "📦 yt-dlp version:"
"$BIN_DIR/yt-dlp" --version || echo "⚠️ Could not verify yt-dlp version"

# Update PATH for runtime (optional)
export PATH="$BIN_DIR:$PATH"
echo "✅ Added $BIN_DIR to PATH"

echo "✅ render-build.sh completed successfully."
