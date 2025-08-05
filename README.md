# YouTube Downloader Backend

## Overview
This is the backend server for the YouTube Downloader application. It provides APIs for fetching video information and downloading videos from YouTube using yt-dlp.

## Requirements
- Node.js (v14 or higher)
- yt-dlp (automatically installed in production)

## Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. For local development, you need to install yt-dlp manually:
   - **Windows**: 
     - Download yt-dlp from https://github.com/yt-dlp/yt-dlp/releases and place it in the server directory
   - **macOS**: 
     ```
     brew install yt-dlp
     ```
   - **Linux**: 
     ```
     sudo apt update
     sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
     sudo chmod a+rx /usr/local/bin/yt-dlp
     ```

3. Start the development server:
   ```
   npm start
   ```

## Production Deployment (Render.com)

The application is configured for deployment on Render.com. The `render-build.sh` script automatically installs yt-dlp globally during the build process.

### Deployment Configuration

The `render.yaml` file contains the configuration for deploying the application on Render.com:

```yaml
services:
  - type: web
    name: downloader-backend
    env: node
    buildCommand: |
      chmod +x render-build.sh
      ./render-build.sh
      npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PATH
        value: /usr/local/bin:/usr/bin:$PATH
```

### Build Script

The `render-build.sh` script installs yt-dlp globally at `/usr/local/bin/yt-dlp` to ensure it's available to the application and persists across deployments.

## Troubleshooting

If you encounter issues with yt-dlp in production:

1. Check the logs to see if yt-dlp was downloaded and installed correctly
2. Verify that the PATH environment variable includes `/usr/local/bin`
3. Make sure the `render-build.sh` script executed successfully during the build process
4. Check if yt-dlp is accessible at `/usr/local/bin/yt-dlp`

## API Endpoints

- `POST /api/download`: Get video information
- `POST /api/download/merged`: Download a video with the specified format
- `POST /api/download/audio`: Download audio only