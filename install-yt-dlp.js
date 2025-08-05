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
    
    const url = isWindows 
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    
    const file = createWriteStream(ytDlpPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${ytDlpFileName}: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded ${ytDlpFileName} successfully`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(ytDlpPath, () => {});
      reject(err);
    });
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