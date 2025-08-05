#!/bin/bash
set -e

# This script installs yt-dlp globally for Render.com deployment

# Function to handle errors
handle_error() {
  echo "Error: $1"
  exit 1
}

# Ensure we have sudo access for global installation
echo "Setting up yt-dlp globally..."

# Create directory if it doesn't exist
echo "Creating directory structure..."
sudo mkdir -p /usr/local/bin || handle_error "Failed to create /usr/local/bin directory"

# Download yt-dlp to global location
echo "Downloading yt-dlp..."
if sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; then
  echo "yt-dlp downloaded successfully to /usr/local/bin"
else
  handle_error "yt-dlp download failed"
fi

# Make yt-dlp executable
echo "Making yt-dlp executable..."
if sudo chmod a+rx /usr/local/bin/yt-dlp; then
  echo "yt-dlp is now executable"
else
  handle_error "Failed to make yt-dlp executable"
fi

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "/usr/local/bin/yt-dlp" ]; then
  echo "yt-dlp found in /usr/local/bin"
  /usr/local/bin/yt-dlp --version || echo "Warning: yt-dlp version check failed"
else
  handle_error "yt-dlp installation verification failed"
fi

# Create symlink in case the app looks for it in a different location
echo "Creating symlinks for compatibility..."
if [ ! -f "/usr/bin/yt-dlp" ]; then
  sudo ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp || echo "Warning: Failed to create symlink in /usr/bin"
fi

# Update yt-dlp to ensure we have the latest version
echo "Updating yt-dlp to latest version..."
/usr/local/bin/yt-dlp -U || echo "Warning: yt-dlp update failed, but continuing with current version"

echo "yt-dlp installation completed successfully!"
echo "Location: $(which yt-dlp)"
echo "Version: $(/usr/local/bin/yt-dlp --version)"