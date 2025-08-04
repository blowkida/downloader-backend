#!/bin/bash
set -e

# Define primary and fallback binary directories
PRIMARY_BIN_DIR="/usr/local/bin"
FALLBACK_BIN_DIR="/tmp/bin"

# Function to handle errors
handle_error() {
  echo "Error: $1"
  echo "Attempting alternative installation method..."
}

# Create binary directories
echo "Creating binary directories..."

# Try to create primary directory first
if sudo mkdir -p "$PRIMARY_BIN_DIR"; then
  echo "$PRIMARY_BIN_DIR directory created or already exists"
  sudo chmod 755 "$PRIMARY_BIN_DIR"
else
  handle_error "Failed to create $PRIMARY_BIN_DIR directory, will use fallback"
  PRIMARY_DIR_FAILED=true
fi

# Always create fallback directory for compatibility
if mkdir -p "$FALLBACK_BIN_DIR"; then
  echo "$FALLBACK_BIN_DIR directory created or already exists"
  chmod 755 "$FALLBACK_BIN_DIR"
else
  if [ "$PRIMARY_DIR_FAILED" = "true" ]; then
    handle_error "Failed to create both $PRIMARY_BIN_DIR and $FALLBACK_BIN_DIR directories"
    exit 1
  else
    handle_error "Failed to create $FALLBACK_BIN_DIR directory, will use $PRIMARY_BIN_DIR only"
  fi
fi

# Download yt-dlp with fallback options
echo "Downloading yt-dlp..."

# First attempt - direct download to primary directory
if sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$PRIMARY_BIN_DIR/yt-dlp"; then
  sudo chmod +x "$PRIMARY_BIN_DIR/yt-dlp"
  echo "yt-dlp downloaded successfully to $PRIMARY_BIN_DIR"
  
  # Create a copy in fallback directory for compatibility
  mkdir -p "$FALLBACK_BIN_DIR"
  ln -sf "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/yt-dlp" || cp "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/yt-dlp"
  chmod +x "$FALLBACK_BIN_DIR/yt-dlp"
  echo "Created symlink or copy in $FALLBACK_BIN_DIR for compatibility"
else
  handle_error "yt-dlp download to $PRIMARY_BIN_DIR failed"
  
  # Second attempt - download to fallback directory
  if curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$FALLBACK_BIN_DIR/yt-dlp"; then
    chmod +x "$FALLBACK_BIN_DIR/yt-dlp"
    echo "yt-dlp downloaded successfully to $FALLBACK_BIN_DIR"
    
    # Try to create a copy in primary directory
    if sudo cp "$FALLBACK_BIN_DIR/yt-dlp" "$PRIMARY_BIN_DIR/yt-dlp" || sudo ln -sf "$FALLBACK_BIN_DIR/yt-dlp" "$PRIMARY_BIN_DIR/yt-dlp"; then
      sudo chmod +x "$PRIMARY_BIN_DIR/yt-dlp"
      echo "yt-dlp copied to $PRIMARY_BIN_DIR"
    else
      handle_error "Failed to copy yt-dlp to $PRIMARY_BIN_DIR"
    fi
  else
    handle_error "yt-dlp download to $FALLBACK_BIN_DIR failed"
    
    # Third attempt - download to current directory
    if curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp; then
      chmod +x ./yt-dlp
      
      # Try to copy to primary directory first
      if sudo cp ./yt-dlp "$PRIMARY_BIN_DIR/" || sudo mv ./yt-dlp "$PRIMARY_BIN_DIR/"; then
        sudo chmod +x "$PRIMARY_BIN_DIR/yt-dlp"
        echo "yt-dlp copied to $PRIMARY_BIN_DIR"
        
        # Create a copy in fallback directory
        mkdir -p "$FALLBACK_BIN_DIR"
        ln -sf "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/" || cp "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/"
        chmod +x "$FALLBACK_BIN_DIR/yt-dlp"
        echo "yt-dlp copied to $FALLBACK_BIN_DIR for compatibility"
      else
        # Try fallback directory
        mkdir -p "$FALLBACK_BIN_DIR"
        if cp ./yt-dlp "$FALLBACK_BIN_DIR/" || mv ./yt-dlp "$FALLBACK_BIN_DIR/"; then
          chmod +x "$FALLBACK_BIN_DIR/yt-dlp"
          echo "yt-dlp copied to $FALLBACK_BIN_DIR"
        else
          handle_error "Failed to copy yt-dlp to any directory"
        fi
      fi
    else
      handle_error "Download to current directory failed"
      
      # Fourth attempt - try using npm
      echo "Attempting to install yt-dlp via npm..."
      npm install -g yt-dlp || {
        echo "Error: All yt-dlp installation methods failed"
        exit 1
      }
      echo "yt-dlp installed via npm"
    fi
  fi
fi

# Verify yt-dlp installation
echo "Verifying yt-dlp installation..."
if [ -f "$PRIMARY_BIN_DIR/yt-dlp" ]; then
  echo "yt-dlp found in $PRIMARY_BIN_DIR"
  $PRIMARY_BIN_DIR/yt-dlp --version || echo "Warning: yt-dlp version check failed"
  
  # Ensure we have a copy in the fallback directory for compatibility
  if [ ! -f "$FALLBACK_BIN_DIR/yt-dlp" ]; then
    mkdir -p $FALLBACK_BIN_DIR
    ln -sf "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/yt-dlp" || cp "$PRIMARY_BIN_DIR/yt-dlp" "$FALLBACK_BIN_DIR/yt-dlp"
    echo "Created symlink or copy in $FALLBACK_BIN_DIR for compatibility"
  fi
elif [ -f "$FALLBACK_BIN_DIR/yt-dlp" ]; then
  echo "yt-dlp found in $FALLBACK_BIN_DIR"
  $FALLBACK_BIN_DIR/yt-dlp --version || echo "Warning: yt-dlp version check failed"
else
  # Check if it was installed globally via npm
  YT_DLP_PATH=$(which yt-dlp)
  if [ -n "$YT_DLP_PATH" ]; then
    echo "yt-dlp found at $YT_DLP_PATH"
    
    # Try to create symlinks in both directories
    if sudo ln -sf "$YT_DLP_PATH" "$PRIMARY_BIN_DIR/yt-dlp" || sudo cp "$YT_DLP_PATH" "$PRIMARY_BIN_DIR/yt-dlp"; then
      sudo chmod +x "$PRIMARY_BIN_DIR/yt-dlp"
      echo "Created symlink or copy in $PRIMARY_BIN_DIR"
    else
      echo "Warning: Could not create symlink or copy in $PRIMARY_BIN_DIR"
    fi
    
    # Always create a copy in the fallback directory
    mkdir -p $FALLBACK_BIN_DIR
    ln -sf "$YT_DLP_PATH" "$FALLBACK_BIN_DIR/yt-dlp" || cp "$YT_DLP_PATH" "$FALLBACK_BIN_DIR/yt-dlp"
    chmod +x "$FALLBACK_BIN_DIR/yt-dlp"
    echo "Created symlink or copy in $FALLBACK_BIN_DIR"
  else
    echo "Error: yt-dlp not found in PATH, $PRIMARY_BIN_DIR, or $FALLBACK_BIN_DIR"
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
      
      # Try to create symlinks in primary directory
      if sudo ln -sf "$FFMPEG_PATH" "$PRIMARY_BIN_DIR/ffmpeg" || sudo cp "$FFMPEG_PATH" "$PRIMARY_BIN_DIR/ffmpeg"; then
        sudo chmod +x "$PRIMARY_BIN_DIR/ffmpeg"
        echo "Created ffmpeg symlink or copy in $PRIMARY_BIN_DIR"
      else
        echo "Warning: Could not create ffmpeg symlink or copy in $PRIMARY_BIN_DIR"
      fi
      
      if sudo ln -sf "$FFPROBE_PATH" "$PRIMARY_BIN_DIR/ffprobe" || sudo cp "$FFPROBE_PATH" "$PRIMARY_BIN_DIR/ffprobe"; then
        sudo chmod +x "$PRIMARY_BIN_DIR/ffprobe"
        echo "Created ffprobe symlink or copy in $PRIMARY_BIN_DIR"
      else
        echo "Warning: Could not create ffprobe symlink or copy in $PRIMARY_BIN_DIR"
      fi
      
      # Always create copies in fallback directory
      mkdir -p $FALLBACK_BIN_DIR
      ln -sf "$FFMPEG_PATH" "$FALLBACK_BIN_DIR/ffmpeg" || cp "$FFMPEG_PATH" "$FALLBACK_BIN_DIR/ffmpeg"
      ln -sf "$FFPROBE_PATH" "$FALLBACK_BIN_DIR/ffprobe" || cp "$FFPROBE_PATH" "$FALLBACK_BIN_DIR/ffprobe"
      chmod +x "$FALLBACK_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffprobe"
      echo "Created symlinks or copies in $FALLBACK_BIN_DIR"
      
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
  
  # Copy FFmpeg binaries to primary directory
  if sudo cp /tmp/ffmpeg/ffmpeg "$PRIMARY_BIN_DIR/" && sudo cp /tmp/ffmpeg/ffprobe "$PRIMARY_BIN_DIR/"; then
    sudo chmod +x "$PRIMARY_BIN_DIR/ffmpeg" "$PRIMARY_BIN_DIR/ffprobe"
    echo "FFmpeg and FFprobe copied to $PRIMARY_BIN_DIR"
    
    # Also copy to fallback directory for compatibility
    mkdir -p $FALLBACK_BIN_DIR
    cp /tmp/ffmpeg/ffmpeg "$FALLBACK_BIN_DIR/" && cp /tmp/ffmpeg/ffprobe "$FALLBACK_BIN_DIR/"
    chmod +x "$FALLBACK_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffprobe"
    echo "FFmpeg and FFprobe also copied to $FALLBACK_BIN_DIR for compatibility"
  else
    handle_error "Failed to copy FFmpeg binaries to $PRIMARY_BIN_DIR"
    
    # Try copying to fallback directory
    if cp /tmp/ffmpeg/ffmpeg "$FALLBACK_BIN_DIR/" && cp /tmp/ffmpeg/ffprobe "$FALLBACK_BIN_DIR/"; then
      chmod +x "$FALLBACK_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffprobe"
      echo "FFmpeg and FFprobe copied to $FALLBACK_BIN_DIR"
    else
      handle_error "Failed to copy FFmpeg binaries to any location"
      exit 1
    fi
  fi
  
  # Clean up
  echo "Cleaning up FFmpeg temporary files..."
  rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg || echo "Warning: Cleanup failed, but installation succeeded"
fi

# Verify FFmpeg installation
echo "Verifying FFmpeg installation..."

# Check primary directory first
if [ -f "$PRIMARY_BIN_DIR/ffmpeg" ] && [ -f "$PRIMARY_BIN_DIR/ffprobe" ]; then
  echo "FFmpeg and FFprobe found in $PRIMARY_BIN_DIR"
  $PRIMARY_BIN_DIR/ffmpeg -version || echo "Warning: ffmpeg version check failed"
  $PRIMARY_BIN_DIR/ffprobe -version || echo "Warning: ffprobe version check failed"
  
  # Ensure fallback directory has copies for compatibility
  if [ ! -f "$FALLBACK_BIN_DIR/ffmpeg" ] || [ ! -f "$FALLBACK_BIN_DIR/ffprobe" ]; then
    echo "Creating fallback copies in $FALLBACK_BIN_DIR for compatibility"
    mkdir -p $FALLBACK_BIN_DIR
    ln -sf "$PRIMARY_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffmpeg" || cp "$PRIMARY_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffmpeg"
    ln -sf "$PRIMARY_BIN_DIR/ffprobe" "$FALLBACK_BIN_DIR/ffprobe" || cp "$PRIMARY_BIN_DIR/ffprobe" "$FALLBACK_BIN_DIR/ffprobe"
    chmod +x "$FALLBACK_BIN_DIR/ffmpeg" "$FALLBACK_BIN_DIR/ffprobe"
  fi
# Check fallback directory if primary fails
elif [ -f "$FALLBACK_BIN_DIR/ffmpeg" ] && [ -f "$FALLBACK_BIN_DIR/ffprobe" ]; then
  echo "FFmpeg and FFprobe found in $FALLBACK_BIN_DIR"
  $FALLBACK_BIN_DIR/ffmpeg -version || echo "Warning: ffmpeg version check failed"
  $FALLBACK_BIN_DIR/ffprobe -version || echo "Warning: ffprobe version check failed"
  
  # Try to create copies in primary directory if possible
  if [ ! -f "$PRIMARY_BIN_DIR/ffmpeg" ] || [ ! -f "$PRIMARY_BIN_DIR/ffprobe" ]; then
    echo "Attempting to create copies in $PRIMARY_BIN_DIR"
    if sudo mkdir -p "$PRIMARY_BIN_DIR" && \
       (sudo ln -sf "$FALLBACK_BIN_DIR/ffmpeg" "$PRIMARY_BIN_DIR/ffmpeg" || sudo cp "$FALLBACK_BIN_DIR/ffmpeg" "$PRIMARY_BIN_DIR/ffmpeg") && \
       (sudo ln -sf "$FALLBACK_BIN_DIR/ffprobe" "$PRIMARY_BIN_DIR/ffprobe" || sudo cp "$FALLBACK_BIN_DIR/ffprobe" "$PRIMARY_BIN_DIR/ffprobe"); then
      sudo chmod +x "$PRIMARY_BIN_DIR/ffmpeg" "$PRIMARY_BIN_DIR/ffprobe"
      echo "Created copies in $PRIMARY_BIN_DIR"
    else
      echo "Warning: Could not create copies in $PRIMARY_BIN_DIR, continuing with $FALLBACK_BIN_DIR only"
    fi
  fi
else
  echo "Error: FFmpeg installation failed"
  exit 1
fi

# Clean up
echo "Cleaning up..."
rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg

# Create setup_complete flag
echo "Creating setup_complete flag..."

# Try creating in primary directory first
if sudo touch "$PRIMARY_BIN_DIR/setup_complete"; then
  echo "Created setup_complete flag in $PRIMARY_BIN_DIR"
else
  handle_error "Failed to create setup_complete flag in $PRIMARY_BIN_DIR"
  
  # Try creating in fallback directory
  if touch "$FALLBACK_BIN_DIR/setup_complete"; then
    echo "Created setup_complete flag in $FALLBACK_BIN_DIR"
  else
    handle_error "Failed to create setup_complete flag in $FALLBACK_BIN_DIR"
    
    # Try creating in /tmp as last resort
    if touch /tmp/setup_complete; then
      echo "Created setup_complete flag in /tmp"
    else
      handle_error "Failed to create setup_complete flag in any location"
    fi
  fi
fi

# Add both directories to PATH in multiple profile files for better compatibility
echo "Adding $PRIMARY_BIN_DIR and $FALLBACK_BIN_DIR to PATH..."
PATH_EXPORT="export PATH=\"$PRIMARY_BIN_DIR:$FALLBACK_BIN_DIR:\$PATH\""

# Try to update various profile files, but don't fail if they're not writable
{ echo "$PATH_EXPORT" >> ~/.bashrc; } || echo "Warning: Could not update ~/.bashrc"
{ echo "$PATH_EXPORT" >> ~/.profile; } || echo "Warning: Could not update ~/.profile"
{ echo "$PATH_EXPORT" >> ~/.bash_profile; } || echo "Warning: Could not update ~/.bash_profile"

# Export PATH for the current session
export PATH="$PRIMARY_BIN_DIR:$FALLBACK_BIN_DIR:$PATH"
echo "PATH updated for current session: $PATH"

echo "Build script completed successfully! yt-dlp and FFmpeg are installed in $PRIMARY_BIN_DIR and $FALLBACK_BIN_DIR"