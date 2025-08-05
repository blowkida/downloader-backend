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
     - **Option 1**: Run the included batch file for automatic installation:
       ```
       install-yt-dlp.bat
       ```
     - **Option 2**: Manual installation:
       - Download yt-dlp from https://github.com/yt-dlp/yt-dlp/releases and place it in the server directory
       - Rename it to `yt-dlp.exe` if it's not already named that
       - Make sure it's in the same directory as your server files
   - **macOS/Linux**: 
     - **Option 1**: Run the included shell script for automatic installation:
       ```
       chmod +x install-yt-dlp.sh
       ./install-yt-dlp.sh
       ```
     - **Option 2**: Manual installation:
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

   **Important**: After installing yt-dlp, verify it's working by running:
    ```
    npm run test-yt-dlp
    ```
    This will test if yt-dlp is installed correctly and can fetch video information.
    
    Alternatively, you can check the version directly:
    - Windows: `yt-dlp.exe --version` in the server directory
    - macOS/Linux: `yt-dlp --version` in terminal

3. **Automatic yt-dlp Installation**:
   The project now includes an automatic installer script that will download and verify yt-dlp for you:
   ```
   npm run install-yt-dlp
   ```
   This script will:
   - Check if yt-dlp is already installed in the server directory
   - Download the latest version if needed
   - Make it executable (on macOS/Linux)
   - Verify it's working correctly

4. Start the development server:
   ```
   npm start
   ```
   
   Note: The installer script will also run automatically during `npm install` via the postinstall hook.

## Production Deployment (Render.com)

The application is configured for deployment on Render.com. The `render-build.sh` script automatically installs yt-dlp during the build process.

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
        value: ./node_modules/.bin:$HOME/bin:.:/usr/local/bin:/usr/bin:$PATH
```

### Build Script

The `render-build.sh` script installs yt-dlp in the user's home directory (`$HOME/bin`) to ensure it's available to the application and persists across deployments. The script:

1. Creates a bin directory in the user's home folder
2. Downloads and installs yt-dlp to this directory
3. Makes yt-dlp executable
4. Creates multiple symlinks for maximum compatibility:
   - In the current directory (`./yt-dlp`)
   - In node_modules/.bin directory for yt-dlp-exec to find
   - In /usr/local/bin if writable (best-effort attempt)
5. Adds the bin directory to the PATH
6. Updates yt-dlp to the latest version

## Troubleshooting

### Resolving "spawn yt-dlp ENOENT" Error

If you encounter the error `spawn yt-dlp ENOENT`, it means the application cannot find the yt-dlp binary. Here's how to fix it:

#### Quick Fix:

Run the automatic installer script:
```
npm run install-yt-dlp
```

Then test if it's working:
```
npm run test-yt-dlp
```

#### For Windows Users:

1. Run the batch file:
   ```
   install-yt-dlp.bat
   ```

2. Verify the binary is in the server directory and named exactly `yt-dlp.exe`

3. Make sure the file is not blocked by Windows security - right-click the file, select Properties, and check if there's an "Unblock" option at the bottom of the General tab

#### For macOS/Linux Users:

1. Run the shell script:
   ```
   chmod +x install-yt-dlp.sh
   ./install-yt-dlp.sh
   ```

2. Verify the binary is executable:
   ```
   chmod +x yt-dlp
   ./yt-dlp --version
   ```

#### How the Application Finds yt-dlp:

The application now uses an improved binary detection system:

1. It first checks if `yt-dlp` (or `yt-dlp.exe` on Windows) exists in the current directory
2. If found, it uses the local binary with absolute path
3. If not found, it falls back to the system path

This logic is implemented in both `index.js` and `ytDlpHelper.js` to ensure consistent behavior.

### For Production (Render.com):

If you encounter issues with yt-dlp in production:

1. Check the logs to see if yt-dlp was downloaded and installed correctly
2. Verify that the PATH environment variable includes all necessary directories: `$HOME/bin:/usr/local/bin:/usr/bin:$PATH`
3. Make sure the `render-build.sh` script executed successfully during the build process
4. Check if yt-dlp is accessible at one of these locations:
   - `$HOME/bin/yt-dlp` (primary installation)
   - `./yt-dlp` (local symlink)
   - `./node_modules/.bin/yt-dlp` (symlink for yt-dlp-exec)
   - `/usr/local/bin/yt-dlp` (system-wide symlink, if writable)

### ENOENT Error Fix

If you encounter the error `spawn /opt/render/project/src/node_modules/yt-dlp-exec/bin/yt-dlp ENOENT`, it means the application is trying to use the yt-dlp binary from node_modules, but it doesn't exist at that path. This has been fixed by:

1. Using the `create` function from yt-dlp-exec to specify the system-installed binary path
2. Ensuring proper symlinks are created in multiple locations
3. Setting the PATH environment variable to include all necessary directories

The code now uses `create(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')` to create a yt-dlp instance that uses the system binary instead of looking in node_modules.

## API Endpoints

- `POST /api/download`: Get video information
- `POST /api/download/merged`: Download a video with the specified format
- `POST /api/download/audio`: Download audio only