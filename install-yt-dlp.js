// install-yt-dlp.js - A helper script to install and verify yt-dlp
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';
import { createWriteStream } from 'fs';

const isWindows = process.platform === 'win32';
const ytDlpFileName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(process.cwd(), ytDlpFileName);

console.log('🔧 yt-dlp installer and verifier');
console.log(`Platform detected: ${isWindows ? 'Windows' : 'macOS/Linux'}`);

// Check if yt-dlp is already installed
function checkYtDlpExists() {
  try {
    if (fs.existsSync(ytDlpPath)) {
      console.log(`✅ ${ytDlpFileName} already exists at: ${ytDlpPath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error checking if ${ytDlpFileName} exists:`, error.message);
    return false;
  }
}

// Download yt-dlp
async function downloadYtDlp() {
  return new Promise((resolve, reject) => {
    console.log(`⬇️ Downloading ${ytDlpFileName}...`);
    
    // Primary GitHub URL
    const githubUrl = isWindows 
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    
    // Fallback direct URL (if GitHub fails)
    const fallbackUrl = isWindows
      ? 'https://yt-dlp.org/latest/yt-dlp.exe'
      : 'https://yt-dlp.org/latest/yt-dlp';
    
    // Try primary URL first
    const url = githubUrl;
    
    const file = createWriteStream(ytDlpPath);
    
    // Function to attempt download from a URL
    const attemptDownload = (downloadUrl) => {
      // Close any existing file stream and create a new one
      if (file) {
        try {
          file.close();
        } catch (err) {
          // Ignore errors when closing file
        }
      }
      
      // Create a new write stream
      const fileStream = createWriteStream(ytDlpPath);
      
      const handleResponse = (response) => {
        // Handle redirects (HTTP 302, 301, etc.)
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          console.log(`🔄 Following redirect to: ${redirectUrl}`);
          https.get(redirectUrl, handleResponse).on('error', handleError);
          return;
        }
        
        if (response.statusCode !== 200) {
          console.log(`⚠️ Failed to download from ${downloadUrl}: HTTP ${response.statusCode}`);
          
          // If primary URL failed, try fallback URL
          if (downloadUrl === githubUrl || downloadUrl.startsWith('https://github.com')) {
            console.log(`🔄 Trying fallback URL: ${fallbackUrl}`);
            attemptDownload(fallbackUrl);
            return;
          }
          
          // If we're already using the fallback URL, then fail
          reject(new Error(`Failed to download ${ytDlpFileName}: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✅ Downloaded ${ytDlpFileName} successfully from ${downloadUrl}`);
          resolve();
        });
      };
      
      const handleError = (err) => {
        console.log(`⚠️ Error downloading from ${downloadUrl}:`, err.message);
        
        // If primary URL failed, try fallback URL
        if (downloadUrl === githubUrl || downloadUrl.startsWith('https://github.com')) {
          console.log(`🔄 Trying fallback URL: ${fallbackUrl}`);
          attemptDownload(fallbackUrl);
          return;
        }
        
        // If we're already using the fallback URL, then fail
        fs.unlink(ytDlpPath, () => {});
        reject(err);
      };
      
      https.get(downloadUrl, handleResponse).on('error', handleError);
    };
    
    // Start the download process with the primary URL
    attemptDownload(url);
  });
}

// Make yt-dlp executable (for macOS/Linux)
function makeExecutable() {
  if (!isWindows) {
    try {
      console.log('🔑 Making yt-dlp executable...');
      execSync(`chmod +x ${ytDlpPath}`);
      console.log('✅ Made yt-dlp executable');
    } catch (error) {
      console.error('❌ Error making yt-dlp executable:', error.message);
      throw error;
    }
  }
}

// Verify yt-dlp works
function verifyYtDlp() {
  try {
    console.log('🔍 Verifying yt-dlp works...');
    const command = isWindows ? `"${ytDlpPath}" --version` : `"${ytDlpPath}" --version`;
    const output = execSync(command).toString().trim();
    console.log(`✅ yt-dlp is working! Version: ${output}`);
    return true;
  } catch (error) {
    console.error('❌ Error verifying yt-dlp:', error.message);
    return false;
  }
}

// Main function
async function main() {
  try {
    const exists = checkYtDlpExists();
    
    if (!exists) {
      await downloadYtDlp();
      makeExecutable();
    }
    
    const verified = verifyYtDlp();
    
    if (verified) {
      console.log('\n🎉 yt-dlp is installed and working correctly!');
      console.log(`The application will use this binary: ${ytDlpPath}`);
    } else {
      console.log('\n❌ yt-dlp installation verification failed.');
      console.log('Please check the error messages above and try again.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error during yt-dlp installation:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();