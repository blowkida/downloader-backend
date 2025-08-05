// test-yt-dlp.js - A simple script to test if yt-dlp is working correctly
import { create } from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the best path for yt-dlp binary
let ytdlpBinaryPath = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

// Check if yt-dlp exists in the current directory (for local development)
const localBinaryPath = path.join(process.cwd(), ytdlpBinaryPath);
if (fs.existsSync(localBinaryPath)) {
  console.log(`✅ Found local yt-dlp binary at: ${localBinaryPath}`);
  ytdlpBinaryPath = localBinaryPath;
} else {
  console.log(`⚠️ Local yt-dlp binary not found at ${localBinaryPath}, will try system path`);
}

// Create ytdlp instance with the determined binary path
const ytdlp = create(ytdlpBinaryPath);

// Test URL - YouTube's most viewed video
const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function testYtDlp() {
  console.log('🔍 Testing yt-dlp installation...');
  console.log(`📌 Using binary path: ${ytdlpBinaryPath}`);
  console.log(`🔗 Testing with URL: ${testUrl}`);
  
  try {
    // Simple test to get video title
    const result = await ytdlp(testUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      skipDownload: true,
      format: 'best',
      getTitle: true,
      getDuration: true,
    });
    
    console.log('\n✅ yt-dlp is working correctly!');
    console.log('📝 Video information:');
    console.log(`  - Title: ${result.title}`);
    console.log(`  - Duration: ${result.duration} seconds`);
    console.log(`  - Upload date: ${result.upload_date}`);
    console.log(`  - Channel: ${result.channel}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ yt-dlp test failed!');
    
    if (error.code === 'ENOENT') {
      console.error('\n🔴 Error: yt-dlp binary not found!');
      console.error(`Attempted to use binary at: ${ytdlpBinaryPath}`);
      console.error('\nPlease install yt-dlp using one of the following methods:');
      console.error('1. Run "npm run install-yt-dlp" to automatically install yt-dlp');
      console.error('2. Run the install-yt-dlp.bat (Windows) or install-yt-dlp.sh (macOS/Linux) script');
      console.error('3. Follow the manual installation instructions in the README.md file');
    } else {
      console.error('Error details:', error.message);
      if (error.stderr) {
        console.error('\nError output:', error.stderr);
      }
    }
    
    return false;
  }
}

// Run the test
testYtDlp().then(success => {
  if (success) {
    console.log('\n🎉 All tests passed! Your yt-dlp installation is working correctly.');
    console.log('You can now run the server with: npm start');
  } else {
    console.log('\n❌ Test failed. Please fix the issues before running the server.');
    process.exit(1);
  }
});