# YouTube Downloader Backend

## Overview
This is the backend server for the YouTube Downloader application. It provides APIs for fetching video information and downloading videos from YouTube using yt-dlp.

## Requirements
- Node.js (v14 or higher)
- yt-dlp (automatically installed in production)
- FFmpeg (automatically installed in production)

## Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. For local development, you need to install yt-dlp and FFmpeg manually:
   - **Windows**: 
     - Download yt-dlp from https://github.com/yt-dlp/yt-dlp/releases and place it in the server directory
     - Download FFmpeg from https://ffmpeg.org/download.html and add it to your PATH
   - **macOS**: 
     ```
     brew install yt-dlp ffmpeg
     ```
   - **Linux**: 
     ```
     sudo apt update
     sudo apt install ffmpeg
     sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
     sudo chmod a+rx /usr/local/bin/yt-dlp
     ```

3. Start the development server:
   ```
   npm start
   ```

## Production Deployment (Render.com)

The application is configured for deployment on Render.com. The `render-build.sh` script automatically downloads and sets up yt-dlp and FFmpeg during the build process.

### Deployment Configuration

The `render.yaml` file contains the configuration for deploying the application on Render.com. It sets up the necessary environment variables and build commands.

## Troubleshooting

If you encounter issues with yt-dlp or FFmpeg in production:

1. Check the logs to see if the binaries were downloaded and installed correctly
2. Verify that the PATH environment variable includes `/tmp/bin`
3. Make sure the `render-build.sh` script executed successfully during the build process

## API Endpoints

- `POST /api/download`: Get video information
- `POST /api/download/merged`: Download a video with the specified format
- `POST /api/download/audio`: Download audio only