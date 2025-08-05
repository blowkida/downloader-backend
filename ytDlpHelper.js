import { create } from "yt-dlp-exec";
import path from "path";
import fs from "fs";
import os from "os";

// Determine the best path for yt-dlp binary
let ytdlpBinaryPath = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

// Check if yt-dlp exists in the current directory (for local development)
const localBinaryPath = path.join(process.cwd(), ytdlpBinaryPath);
if (fs.existsSync(localBinaryPath)) {
  console.log(`ytDlpHelper: Using local yt-dlp binary at: ${localBinaryPath}`);
  ytdlpBinaryPath = localBinaryPath;
} else {
  console.log(`ytDlpHelper: Local yt-dlp binary not found at ${localBinaryPath}, using system path`);
}

// Create ytdlp instance with the determined binary path
const ytdlp = create(ytdlpBinaryPath);

// Helper function to format filesize
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>s</mi><mi>i</mi><mi>z</mi><mi>e</mi><mi mathvariant="normal">.</mi><mi>t</mi><mi>o</mi><mi>F</mi><mi>i</mi><mi>x</mi><mi>e</mi><mi>d</mi><mo stretchy="false">(</mo><mn>2</mn><mo stretchy="false">)</mo></mrow><annotation encoding="application/x-tex">{size.toFixed(2)} </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord"><span class="mord mathnormal">s</span><span class="mord mathnormal">i</span><span class="mord mathnormal">ze</span><span class="mord">.</span><span class="mord mathnormal">t</span><span class="mord mathnormal">o</span><span class="mord mathnormal" style="margin-right:0.13889em;">F</span><span class="mord mathnormal">i</span><span class="mord mathnormal">x</span><span class="mord mathnormal">e</span><span class="mord mathnormal">d</span><span class="mopen">(</span><span class="mord">2</span><span class="mclose">)</span></span></span></span></span>{units[unitIndex]}`;
}

/**
 * Fetch video info from a URL using yt-dlp
 * @param {string} url - The video URL
 * @param {string} cookiesPath - Path to cookies file (optional)
 * @returns {Promise<object>} - Video information object
 */
async function fetchVideoInfo(url, cookiesPath = null) {
  let tempCookieFile = null;
  
  try {
    console.log(`[<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mrow><mi>n</mi><mi>e</mi><mi>w</mi><mi>D</mi><mi>a</mi><mi>t</mi><mi>e</mi><mo stretchy="false">(</mo><mo stretchy="false">)</mo><mi mathvariant="normal">.</mi><mi>t</mi><mi>o</mi><mi>I</mi><mi>S</mi><mi>O</mi><mi>S</mi><mi>t</mi><mi>r</mi><mi>i</mi><mi>n</mi><mi>g</mi><mo stretchy="false">(</mo><mo stretchy="false">)</mo></mrow><mo stretchy="false">]</mo><mi>F</mi><mi>e</mi><mi>t</mi><mi>c</mi><mi>h</mi><mi>i</mi><mi>n</mi><mi>g</mi><mi>v</mi><mi>i</mi><mi>d</mi><mi>e</mi><mi>o</mi><mi>i</mi><mi>n</mi><mi>f</mi><mi>o</mi><mi>f</mi><mi>o</mi><mi>r</mi></mrow><annotation encoding="application/x-tex">{new Date().toISOString()}] Fetching video info for </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord"><span class="mord mathnormal">n</span><span class="mord mathnormal">e</span><span class="mord mathnormal" style="margin-right:0.02691em;">w</span><span class="mord mathnormal" style="margin-right:0.02778em;">D</span><span class="mord mathnormal">a</span><span class="mord mathnormal">t</span><span class="mord mathnormal">e</span><span class="mopen">(</span><span class="mclose">)</span><span class="mord">.</span><span class="mord mathnormal">t</span><span class="mord mathnormal">o</span><span class="mord mathnormal" style="margin-right:0.07847em;">I</span><span class="mord mathnormal">SOSt</span><span class="mord mathnormal" style="margin-right:0.02778em;">r</span><span class="mord mathnormal">in</span><span class="mord mathnormal" style="margin-right:0.03588em;">g</span><span class="mopen">(</span><span class="mclose">)</span></span><span class="mclose">]</span><span class="mord mathnormal" style="margin-right:0.13889em;">F</span><span class="mord mathnormal">e</span><span class="mord mathnormal">t</span><span class="mord mathnormal">c</span><span class="mord mathnormal">hin</span><span class="mord mathnormal" style="margin-right:0.03588em;">gv</span><span class="mord mathnormal">i</span><span class="mord mathnormal">d</span><span class="mord mathnormal">eo</span><span class="mord mathnormal">in</span><span class="mord mathnormal" style="margin-right:0.10764em;">f</span><span class="mord mathnormal">o</span><span class="mord mathnormal" style="margin-right:0.10764em;">f</span><span class="mord mathnormal" style="margin-right:0.02778em;">or</span></span></span></span>{url}`);
    
    // Handle cookies - first try environment variable
    if (process.env.COOKIES_CONTENT && !cookiesPath) {
      console.log('Using cookies from environment variable');
      try {
        // Create temp file for cookies
        tempCookieFile = path.join(os.tmpdir(), `youtube-cookies-${Date.now()}.txt`);
        fs.writeFileSync(tempCookieFile, process.env.COOKIES_CONTENT);
        cookiesPath = tempCookieFile;
        console.log(`Created temporary cookies file at: ${cookiesPath}`);
      } catch (err) {
        console.error('Failed to write cookies from environment variable:', err);
      }
    }
    
    // Check file paths if no cookies found yet
    if (!cookiesPath || !fs.existsSync(cookiesPath)) {
      const possibleCookiePaths = [
        './youtube-cookies.txt',                               // Local relative path
        path.join(process.cwd(), 'youtube-cookies.txt'),       // Process working directory 
        path.resolve('/opt/render/project/src/youtube-cookies.txt'), // Render.com path
        '/youtube-cookies.txt',                                // Root directory
      ];

      for (const cookiePath of possibleCookiePaths) {
        if (fs.existsSync(cookiePath)) {
          cookiesPath = cookiePath;
          console.log(`Found cookies file at: ${cookiesPath}`);
          break;
        }
      }
      
      if (!cookiesPath || !fs.existsSync(cookiesPath)) {
        console.warn('No cookies file found in any of the standard locations');
      }
    }
    
    // Prepare options for fetching video info
    const options = {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: false,
      referer: 'https://www.youtube.com/',
      addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']
    };
    
    // Add cookies if path is provided and file exists
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      console.log(`Using cookies file at: ${cookiesPath}`);
      options.cookies = cookiesPath;
    } else {
      console.log(`No usable cookies file found, continuing without cookies`);
    }
    
    // Execute yt-dlp to get video info
    console.log(`Executing yt-dlp with options: ${JSON.stringify({ ...options, cookies: options.cookies ? '[REDACTED]' : undefined }, null, 2)}`);
    const videoData = await ytdlp(url, options);
    
    if (!videoData) {
      throw new Error('No video data returned from yt-dlp');
    }
    
    const { title, formats, thumbnails, description, duration, upload_date, uploader, webpage_url, id } = videoData;
    
    // Filter and process formats to extract quality options
    const qualityOptions = formats
      .filter(format => format.url && (format.vcodec !== 'none' || format.acodec !== 'none'))
      .map(format => {
        const hasVideo = format.vcodec !== 'none';
        const hasAudio = format.acodec !== 'none';
        const height = format.height || '';
        const fps = format.fps || '';
        const filesize = format.filesize || format.filesize_approx || null;
        
        // Generate readable labels
        let qualityLabel = '';
        if (hasVideo) {
          qualityLabel = `${height}p`;
          if (fps) qualityLabel += ` ${fps}fps`;
          if (!hasAudio) qualityLabel += ' (video only)';
        } else if (hasAudio) {
          qualityLabel = `Audio ${format.abr || ''} kbps`;
        }
        
        // Get container format
        const ext = format.ext || '';
        
        return {
          formatId: format.format_id,
          url: format.url,
          qualityLabel,
          hasVideo,
          hasAudio,
          height: height || null,
          fps: fps || null,
          filesize,
          readableFilesize: formatFileSize(filesize),
          ext,
          vcodec: format.vcodec,
          acodec: format.acodec
        };
      })
      .sort((a, b) => {
        // Sort by resolution (highest first) then by having both audio and video
        if (a.height !== b.height && a.height && b.height) {
          return b.height - a.height;
        }
        if (a.hasVideo && a.hasAudio && (!b.hasVideo || !b.hasAudio)) {
          return -1;
        }
        if (b.hasVideo && b.hasAudio && (!a.hasVideo || !a.hasAudio)) {
          return 1;
        }
        return 0;
      });
    
    // Format thumbnails
    const thumbnail = thumbnails && thumbnails.length > 0
      ? thumbnails.reduce((prev, current) => (current.width > prev.width ? current : prev), thumbnails[0]).url
      : '';
    
    // Return processed video info
    return {
      title,
      id,
      description,
      duration,
      uploadDate: upload_date,
      uploader,
      webpage_url,
      thumbnail,
      qualityOptions
    };
  } catch (error) {
    console.error(`Error fetching video info: ${error.message}`);
    
    // Enhanced error reporting
    let errorMessage = error.message;
    
    // Check if error contains stderr information
    if (error.stderr) {
      console.error(`yt-dlp stderr output: ${error.stderr}`);
      
      // Improve error messages for common issues
      if (error.stderr.includes('Sign in to confirm your age')) {
        errorMessage = 'Age-restricted video. Cookies required for access.';
      } else if (error.stderr.includes('Private video')) {
        errorMessage = 'This video is private.';
      } else if (error.stderr.includes('This video is available for Premium members only')) {
        errorMessage = 'Premium-only video. Premium cookies required for access.';
      } else if (error.stderr.includes('not available in your country')) {
        errorMessage = 'This video is not available in your region.';
      } else if (error.stderr.includes('cookies') || error.stderr.includes('Cookie')) {
        errorMessage = 'Cookie error: ' + error.message;
        console.error('Cookie error detected. Current cookies path: ' + cookiesPath);
        console.error('Cookie file exists: ' + (cookiesPath ? fs.existsSync(cookiesPath) : false));
      }
    }
    
    // Add debugging information about binary
    try {
      const binaryVersion = require('child_process').execSync('yt-dlp --version').toString().trim();
      console.error(`yt-dlp binary version: ${binaryVersion}`);
    } catch (versionError) {
      console.error('Could not determine yt-dlp version:', versionError.message);
    }
    
    // Throw error with improved message
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.stderr = error.stderr;
    throw enhancedError;
  } finally {
    // Clean up temporary cookie file if created
    if (tempCookieFile && fs.existsSync(tempCookieFile)) {
      try {
        fs.unlinkSync(tempCookieFile);
        console.log(`Cleaned up temporary cookie file: ${tempCookieFile}`);
      } catch (err) {
        console.error(`Failed to clean up temporary cookie file: ${err.message}`);
      }
    }
  }
}

export default fetchVideoInfo;
