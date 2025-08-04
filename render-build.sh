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
      }
      echo "yt-dlp installed via npm"
    fi
  fi
fi

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "$BIN_DIR/yt-dlp" ]; then
  echo "yt-dlp found in $BIN_DIR"
  $BIN_DIR/yt-dlp --version || echo "Warning: yt-dlp version check failed"
else
  # Check if it was installed globally via npm
  YT_DLP_PATH=$(which yt-dlp)
  if [ -n "$YT_DLP_PATH" ]; then
    echo "yt-dlp found at $YT_DLP_PATH"
    
    # Create a copy in the bin directory
    ln -sf "$YT_DLP_PATH" "$BIN_DIR/yt-dlp" || cp "$YT_DLP_PATH" "$BIN_DIR/yt-dlp"
    chmod +x "$BIN_DIR/yt-dlp"
    echo "Created symlink or copy in $BIN_DIR"
  else
    echo "Error: yt-dlp not found in PATH or $BIN_DIR"
    exit 1
  fi
fi

# Download and install FFmpeg with fallback options
echo "Downloading FFmpeg..."

# First attempt - download to /tmp and install to /usr/local/bin
if curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz; then
  echo "FFmpeg archive downloaded successfully"
else
  handle_error "FFmpeg download to /tmp failed"
  
  # Second attempt - download to current directory
  if curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ./ffmpeg.tar.xz; then
    echo "FFmpeg archive downloaded to current directory"
    mv ./ffmpeg.tar.xz /tmp/ || cp ./ffmpeg.tar.xz /tmp/
  else
    handle_error "All FFmpeg download attempts failed"
    echo "Checking if FFmpeg is already installed in PATH..."
    
    # Check if FFmpeg is already in PATH
    FFMPEG_PATH=$(which ffmpeg)
    FFPROBE_PATH=$(which ffprobe)
    
    if [ -n "$FFMPEG_PATH" ] && [ -n "$FFPROBE_PATH" ]; then
      echo "FFmpeg and FFprobe found in PATH"
      
      # Create copies in bin directory
      cp "$FFMPEG_PATH" "$BIN_DIR/ffmpeg" || ln -sf "$FFMPEG_PATH" "$BIN_DIR/ffmpeg"
      cp "$FFPROBE_PATH" "$BIN_DIR/ffprobe" || ln -sf "$FFPROBE_PATH" "$BIN_DIR/ffprobe"
      chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
      echo "Created copies in $BIN_DIR"
      
      # Skip to verification
      goto_verification=true
    else
      echo "Error: FFmpeg not found in PATH and download failed"
      exit 1
    fi
  fi
fi

# Extract FFmpeg if we downloaded it
if [ "$goto_verification" != "true" ]; then
  echo "Extracting FFmpeg..."
  mkdir -p /tmp/ffmpeg
  
  if tar xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1; then
    echo "FFmpeg extracted successfully"
  else
    handle_error "FFmpeg extraction failed"
    exit 1
  fi
  
  # Copy FFmpeg binaries to bin directory
  if cp /tmp/ffmpeg/ffmpeg "$BIN_DIR/" && cp /tmp/ffmpeg/ffprobe "$BIN_DIR/"; then
    chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
    echo "FFmpeg and FFprobe copied to $BIN_DIR"
  else
    handle_error "Failed to copy FFmpeg binaries to $BIN_DIR"
    exit 1
  fi
  
  # Clean up
  echo "Cleaning up FFmpeg temporary files..."
  rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg || echo "Warning: Cleanup failed, but installation succeeded"
fi

# Verify FFmpeg installation
echo "Verifying FFmpeg installation..."
if [ -f "$BIN_DIR/ffmpeg" ] && [ -f "$BIN_DIR/ffprobe" ]; then
  echo "FFmpeg and FFprobe found in $BIN_DIR"
  $BIN_DIR/ffmpeg -version || echo "Warning: ffmpeg version check failed"
  $BIN_DIR/ffprobe -version || echo "Warning: ffprobe version check failed"
else
  echo "Error: FFmpeg installation failed"
  exit 1
fi

# Clean up
echo "Cleaning up..."
rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg

# Create setup_complete flag
echo "Creating setup_complete flag..."

# Create setup flag in bin directory
if touch "$BIN_DIR/setup_complete"; then
  echo "Created setup_complete flag in $BIN_DIR"
  else
    handle_error "Failed to create setup_complete flag in $BIN_DIR"
  fi
fi

# Add directory to PATH in multiple profile files for better compatibility
echo "Adding $BIN_DIR to PATH..."
PATH_EXPORT="export PATH=\"$BIN_DIR:\$PATH\""

# Try to update various profile files, but don't fail if they're not writable
{ echo "$PATH_EXPORT" >> ~/.bashrc; } || echo "Warning: Could not update ~/.bashrc"
{ echo "$PATH_EXPORT" >> ~/.profile; } || echo "Warning: Could not update ~/.profile"
{ echo "$PATH_EXPORT" >> ~/.bash_profile; } || echo "Warning: Could not update ~/.bash_profile"

# Export PATH for the current session
export PATH="$BIN_DIR:$PATH"
echo "PATH updated for current session: $PATH"

echo "Build script completed successfully! yt-dlp and FFmpeg are installed in $BIN_DIR"