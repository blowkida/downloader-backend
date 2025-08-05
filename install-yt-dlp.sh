#!/bin/bash

echo "===================================="
echo "yt-dlp Installer for macOS/Linux"
echo "===================================="
echo 

# Determine the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YTDLP_PATH="$SCRIPT_DIR/yt-dlp"

echo "Checking if yt-dlp already exists..."
if [ -f "$YTDLP_PATH" ]; then
    echo "yt-dlp already exists in the current directory."
else
    echo "Downloading yt-dlp from GitHub..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$YTDLP_PATH"
    
    if [ $? -ne 0 ]; then
        echo "Failed to download yt-dlp. Please check your internet connection and try again."
        exit 1
    fi
    
    echo "yt-dlp has been downloaded successfully."
    
    echo "Making yt-dlp executable..."
    chmod +x "$YTDLP_PATH"
    
    if [ $? -ne 0 ]; then
        echo "Failed to make yt-dlp executable. Please check your permissions."
        exit 1
    fi
fi

echo 
echo "Verifying yt-dlp works correctly..."

"$YTDLP_PATH" --version

if [ $? -ne 0 ]; then
    echo "Failed to run yt-dlp. Please check if the file is not corrupted."
    exit 1
fi

echo 
echo "===================================="
echo "yt-dlp is installed and working correctly!"
echo "Location: $YTDLP_PATH"
echo "===================================="
echo 
echo "You can now run the server with: npm start"
echo 

# Check if we're on macOS and offer to install via Homebrew
if [[ "$(uname)" == "Darwin" ]]; then
    echo "Note: On macOS, you can also install yt-dlp using Homebrew:"
    echo "  brew install yt-dlp"
    echo 
fi