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

# Try GitHub URL first
if ! curl -L -f -S --retry 3 --retry-delay 3 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"; then
  echo "⚠️ GitHub download failed, trying fallback URL..."
  # Try fallback URL
  curl -L -f -S --retry 3 --retry-delay 3 https://yt-dlp.org/latest/yt-dlp -o "$BIN_DIR/yt-dlp"
fi

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

# Create node_modules/.bin directory if it doesn't exist
echo "📁 Creating node_modules/.bin directory..."
mkdir -p "./node_modules/.bin"

# Create node_modules/yt-dlp-exec/bin directory if it doesn't exist
echo "📁 Creating node_modules/yt-dlp-exec/bin directory..."
mkdir -p "./node_modules/yt-dlp-exec/bin"

# Create symlinks to yt-dlp in various locations
echo "🔗 Creating symlinks to yt-dlp..."
ln -sf "$BIN_DIR/yt-dlp" "./node_modules/.bin/yt-dlp"
ln -sf "$BIN_DIR/yt-dlp" "./node_modules/yt-dlp-exec/bin/yt-dlp"
ln -sf "$BIN_DIR/yt-dlp" "./yt-dlp"

# Try to create a symlink in /usr/local/bin if possible (might require sudo)
if [ -w "/usr/local/bin" ]; then
  echo "📁 Creating symlink in /usr/local/bin..."
  ln -sf "$BIN_DIR/yt-dlp" "/usr/local/bin/yt-dlp"
fi

# Verify installations
echo "🔍 Verifying installations..."
which yt-dlp || echo "⚠️ yt-dlp not found in PATH"
ls -la "./node_modules/.bin/yt-dlp" || echo "⚠️ Symlink in node_modules/.bin not created"
ls -la "./node_modules/yt-dlp-exec/bin/yt-dlp" || echo "⚠️ Symlink in node_modules/yt-dlp-exec/bin not created"

echo "✅ Build script completed successfully."
