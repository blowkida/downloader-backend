#!/bin/bash
set -e

# This script installs yt-dlp for Render.com deployment
# Modified to work without sudo privileges in Render.com environment

# Function to handle errors
handle_error() {
  echo "Error: $1"
  exit 1
}

# Define installation directories
# Use HOME directory which is always writable by the current user
BIN_DIR="$HOME/bin"
USR_LOCAL_BIN="/usr/local/bin"

# Create bin directory in home folder (always accessible)
echo "Creating binary directory in $BIN_DIR..."
if mkdir -p "$BIN_DIR"; then
  echo "$BIN_DIR directory created or already exists"
  chmod 755 "$BIN_DIR"
else
  handle_error "Failed to create $BIN_DIR directory"
fi

# Download yt-dlp to user's bin directory
echo "Downloading yt-dlp..."
if curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"; then
  chmod +x "$BIN_DIR/yt-dlp"
  echo "yt-dlp downloaded successfully to $BIN_DIR"
else
  handle_error "yt-dlp download failed"
fi

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "$BIN_DIR/yt-dlp" ]; then
  echo "yt-dlp found in $BIN_DIR"
  "$BIN_DIR/yt-dlp" --version || echo "Warning: yt-dlp version check failed"
else
  handle_error "yt-dlp installation verification failed"
fi

# Create symbolic link to /usr/local/bin if we have write access
# This is a best-effort attempt, not critical for functionality
echo "Attempting to create symbolic link in $USR_LOCAL_BIN (if possible)..."
if [ -d "$USR_LOCAL_BIN" ] && [ -w "$USR_LOCAL_BIN" ]; then
  echo "$USR_LOCAL_BIN is writable, creating symlink"
  ln -sf "$BIN_DIR/yt-dlp" "$USR_LOCAL_BIN/yt-dlp" || echo "Warning: Failed to create symlink in $USR_LOCAL_BIN"
else
  echo "$USR_LOCAL_BIN is not writable, skipping symlink creation"
  # Create a local symlink in the current directory as fallback
  ln -sf "$BIN_DIR/yt-dlp" "./yt-dlp" || echo "Warning: Failed to create local symlink"
fi

# Update yt-dlp to ensure we have the latest version
echo "Updating yt-dlp to latest version..."
"$BIN_DIR/yt-dlp" -U || echo "Warning: yt-dlp update failed, but continuing with current version"

# Add bin directory to PATH for this session
export PATH="$BIN_DIR:$PATH"
echo "Added $BIN_DIR to PATH"

echo "yt-dlp installation completed successfully!"
echo "Location: $BIN_DIR/yt-dlp"
echo "Version: $($BIN_DIR/yt-dlp --version)"