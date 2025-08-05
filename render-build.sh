#!/bin/bash
set -e

# Define binary directory
BIN_DIR="/tmp/bin"

# Function to handle errors
handle_error() {
  echo "Error: $1"
}

# Create binary directory
echo "Creating binary directory..."
if mkdir -p "$BIN_DIR"; then
  echo "$BIN_DIR directory created or already exists"
  chmod 755 "$BIN_DIR"
else
  handle_error "Failed to create $BIN_DIR directory"
  exit 1
fi

# Download yt-dlp
echo "Downloading yt-dlp..."
if curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"; then
  chmod +x "$BIN_DIR/yt-dlp"
  echo "yt-dlp downloaded successfully to $BIN_DIR"
else
  handle_error "yt-dlp download to $BIN_DIR failed"

  # Try downloading to current directory and then move
  if curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp; then
    chmod +x ./yt-dlp
    if mv ./yt-dlp "$BIN_DIR/"; then
      echo "yt-dlp moved to $BIN_DIR"
    else
      handle_error "Failed to move yt-dlp to $BIN_DIR"
      exit 1
    fi
  else
    handle_error "All yt-dlp download attempts failed"
    exit 1
  fi
fi

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "$BIN_DIR/yt-dlp" ]; then
  echo "yt-dlp found in $BIN_DIR"
  "$BIN_DIR/yt-dlp" --version || echo "Warning: yt-dlp version check failed"
else
  echo "Error: yt-dlp installation failed"
  exit 1
fi

# Add directory to PATH
echo "Adding $BIN_DIR to PATH..."
PATH_EXPORT="export PATH=\"$BIN_DIR:\$PATH\""

# Export PATH for the current session
export PATH="$BIN_DIR:$PATH"
echo "PATH updated for current session: $PATH"

echo "Build script completed successfully! yt-dlp is installed in $BIN_DIR"