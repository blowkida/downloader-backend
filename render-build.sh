#!/bin/bash
set -e

echo "Setting up yt-dlp binary..."

# Create a local bin directory
BIN_DIR="$HOME/bin"
mkdir -p "$BIN_DIR"
chmod 755 "$BIN_DIR"

# Download the latest yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"
chmod +x "$BIN_DIR/yt-dlp"

# Ensure yt-dlp-exec can find it by copying it into the expected location
mkdir -p ./node_modules/yt-dlp-exec/bin
cp "$BIN_DIR/yt-dlp" ./node_modules/yt-dlp-exec/bin/yt-dlp
chmod +x ./node_modules/yt-dlp-exec/bin/yt-dlp

echo "yt-dlp installed and linked for yt-dlp-exec"
