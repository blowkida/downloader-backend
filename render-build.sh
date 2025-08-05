#!/bin/bash
# render-build.sh - Setup script for YouTube downloader on Render.com

echo "Starting Render.com build script..."

# Install system dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y ffmpeg python3 python3-pip curl wget

# Install yt-dlp
echo "Installing yt-dlp..."
pip3 install yt-dlp

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Check if COOKIES_CONTENT environment variable is set
if [ -z "$COOKIES_CONTENT" ]; then
  echo "COOKIES_CONTENT environment variable not set."
  
  # Check if FILE_ID is set for downloading cookies from Google Drive
  if [ -n "$FILE_ID" ]; then
    echo "FILE_ID is set, downloading cookies from Google Drive..."
    COOKIES_FILE="youtube-cookies.txt"
    wget --no-check-certificate "https://drive.google.com/uc?export=download&id=<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mrow><mi>F</mi><mi>I</mi><mi>L</mi><msub><mi>E</mi><mi>I</mi></msub><mi>D</mi></mrow><mi mathvariant="normal">&quot;</mi><mo>−</mo><mi>O</mi></mrow><annotation encoding="application/x-tex">{FILE_ID}&quot; -O </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.8444em;vertical-align:-0.15em;"></span><span class="mord"><span class="mord mathnormal" style="margin-right:0.13889em;">F</span><span class="mord mathnormal" style="margin-right:0.07847em;">I</span><span class="mord mathnormal">L</span><span class="mord"><span class="mord mathnormal" style="margin-right:0.05764em;">E</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.3283em;"><span style="top:-2.55em;margin-left:-0.0576em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mathnormal mtight" style="margin-right:0.07847em;">I</span></span></span></span><span class="vlist-s">​</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span></span><span class="mord mathnormal" style="margin-right:0.02778em;">D</span></span><span class="mord">&quot;</span><span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">−</span><span class="mspace" style="margin-right:0.2222em;"></span></span><span class="base"><span class="strut" style="height:0.6833em;"></span><span class="mord mathnormal" style="margin-right:0.02778em;">O</span></span></span></span>{COOKIES_FILE}
    
    # If download successful, set environment variable
    if [ -f "$COOKIES_FILE" ]; then
      echo "Setting COOKIES_CONTENT from downloaded file..."
      # Read file content and set as environment variable
      export COOKIES_CONTENT=<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mo stretchy="false">(</mo><mi>c</mi><mi>a</mi><mi>t</mi></mrow><annotation encoding="application/x-tex">(cat </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mopen">(</span><span class="mord mathnormal">c</span><span class="mord mathnormal">a</span><span class="mord mathnormal">t</span></span></span></span>{COOKIES_FILE})
      
      # Remove the file for security
      rm ${COOKIES_FILE}
      echo "Cookie file processed and removed."
    else
      echo "Failed to download cookies file."
    fi
  else
    echo "Neither COOKIES_CONTENT nor FILE_ID is set. Some videos may not be accessible."
  fi
else
  echo "COOKIES_CONTENT environment variable is already set."
fi

# Create temp directory for downloads
mkdir -p temp
echo "Created temp directory for downloads"

echo "Build script completed."
