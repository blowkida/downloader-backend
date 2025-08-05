@echo off
echo ===================================
echo yt-dlp Windows Installer
echo ===================================
echo.

echo Checking if yt-dlp.exe already exists...
if exist "%~dp0yt-dlp.exe" (
    echo yt-dlp.exe already exists in the current directory.
    goto :verify
)

echo Downloading yt-dlp.exe from GitHub...
powershell -Command "(New-Object Net.WebClient).DownloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', '%~dp0yt-dlp.exe')"

if %ERRORLEVEL% neq 0 (
    echo Failed to download yt-dlp.exe. Please check your internet connection and try again.
    exit /b 1
)

echo yt-dlp.exe has been downloaded successfully.

:verify
echo.
echo Verifying yt-dlp.exe works correctly...

"%~dp0yt-dlp.exe" --version

if %ERRORLEVEL% neq 0 (
    echo Failed to run yt-dlp.exe. Please check if the file is not corrupted or blocked by your antivirus.
    exit /b 1
)

echo.
echo ===================================
echo yt-dlp.exe is installed and working correctly!
echo Location: %~dp0yt-dlp.exe
echo ===================================
echo.
echo You can now run the server with: npm start
echo.

pause