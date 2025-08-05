// ytDlpHelper.js
import { create } from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Determine the best path for yt-dlp binary
let ytdlpBinaryPath = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

// Check if yt-dlp exists in the current directory (for local development)
const localBinaryPath = path.join(process.cwd(), ytdlpBinaryPath);
if (fs.existsSync(localBinaryPath)) {
  console.log(`Using local yt-dlp binary at: ${localBinaryPath}`);
  ytdlpBinaryPath = localBinaryPath;
} else {
  console.log(`Local yt-dlp binary not found at ${localBinaryPath}, using system path`);
}

// Create ytdlp instance with the determined binary path
// This ensures we use the best available binary rather than expecting it in node_modules
const ytdlp = create(ytdlpBinaryPath);

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if cookies file is valid (exists and has content)
function isValidCookiesFile(cookiesPath) {
  try {
    if (!fs.existsSync(cookiesPath)) {
      return false;
    }
    
    const stats = fs.statSync(cookiesPath);
    // Check if file is empty or too small to be valid
    if (stats.size < 50) { // Minimum size for a valid cookies file
      console.log(`Cookies file exists but is too small (${stats.size} bytes), might be invalid`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error checking cookies file: ${err.message}`);
    return false;
  }
}

function formatDuration(seconds) {
  if (!seconds) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Helper function to handle yt-dlp errors with better messages
async function runYtDlpWithErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    // Handle ENOENT error (binary not found)
    if (error.code === 'ENOENT') {
      console.error('ERROR: yt-dlp binary not found!');
      console.error(`Attempted to use binary at: ${ytdlpBinaryPath}`);
      console.error('Please install yt-dlp using one of the following methods:');
      console.error('1. Run "npm run install-yt-dlp" to automatically install yt-dlp');
      console.error('2. Run the install-yt-dlp.bat (Windows) or install-yt-dlp.sh (macOS/Linux) script');
      console.error('3. Follow the manual installation instructions in the README.md file');
      
      // Throw a more user-friendly error
      throw new Error('yt-dlp binary not found. Please install yt-dlp first.');
    }
    
    // Re-throw other errors
    throw error;
  }
}

export default async function fetchVideoInfo(url) {
  console.log('Fetching video info for URL:', url);
  
  // Validate URL format
  if (!url || typeof url !== 'string') {
    console.error('Invalid URL provided:', url);
    throw new Error("Invalid URL provided. Please enter a valid YouTube URL.");
  }

  // Basic URL validation
  if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)) {
    console.error('Invalid YouTube URL format:', url);
    throw new Error("Invalid YouTube URL. Please enter a valid YouTube video URL.");
  }
  
  // Use the error handling wrapper for all yt-dlp operations
  return await runYtDlpWithErrorHandling(async () => {

  try {
    // Check if cookies file exists and is valid - use absolute path resolution
    const cookiesPath = path.resolve(process.cwd(), 'youtube-cookies.txt');
    const cookiesValid = isValidCookiesFile(cookiesPath);
    
    if (cookiesValid) {
      console.log(`Found valid cookies file at: ${cookiesPath}`);
      // Log file permissions and size for debugging
      try {
        const stats = fs.statSync(cookiesPath);
        console.log(`Cookies file size: ${stats.size} bytes, permissions: ${stats.mode.toString(8)}`);
      } catch (err) {
        console.error(`Error checking cookies file stats: ${err.message}`);
      }
    } else {
      console.log(`Valid cookies file not found at: ${cookiesPath}, will rely on browser cookies`);
    }
    
    // Get proxy URL from environment variables if available
    const proxyUrl = process.env.PROXY_URL || null;
    
    // Use a configuration focused on getting all formats including audio and video with audio
    // Prioritize MP4 formats and avoid m3u8 formats
    const ytdlpOptions = {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      youtubeSkipDashManifest: false,
      referer: 'https://www.youtube.com/',
      skipDownload: true,
      forceIpv4: true,
      socketTimeout: 120, // Increased timeout for better reliability
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0, // best quality
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', // Added fallback to any best format
      mergeOutputFormat: 'mp4', // Ensure we merge to MP4 format
      embedThumbnail: true,
      cookies: cookiesValid ? cookiesPath : null,
      cookiesFromBrowser: ['chrome', 'edge', 'firefox', 'opera', 'brave', 'vivaldi', 'safari'].join(','), // Try all possible browsers
      addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0']
      // Removed proxy setting as it was causing connection timeouts
    };
    
    // Note: yt-dlp-exec doesn't support the binPath option directly
      // It uses the yt-dlp binary from node_modules by default
      // We'll log this information for debugging purposes
      if (process.platform === 'win32') {
        console.log("Running on Windows platform");
        
        // Check if yt-dlp exists in various locations for debugging
        const possiblePaths = [
          './yt-dlp.exe',
          './bin/yt-dlp.exe',
          './yt-dlp_new.exe',
          '../yt-dlp.exe',
          '../bin/yt-dlp.exe',
          path.join(__dirname, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
        ];
        
        for (const testPath of possiblePaths) {
          try {
            if (fs.existsSync(testPath)) {
              console.log(`Found yt-dlp binary at: ${testPath}`);
            }
          } catch (err) {
            console.error(`Error checking path ${testPath}:`, err);
          }
        }
        
        console.log("Using default yt-dlp binary from node_modules");
      }
    
    console.log('Using ytdlpOptions:', JSON.stringify(ytdlpOptions, null, 2));
    console.log('Using cookies file:', cookiesValid ? cookiesPath : 'No cookies file found');

    try {
      console.log('Executing yt-dlp with options:', JSON.stringify(ytdlpOptions, null, 2));
      console.log('Using yt-dlp executable path:', process.platform === 'win32' ? './yt-dlp.exe' : 'yt-dlp');
      
      // Add a timeout promise to handle potential hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('yt-dlp operation timed out after 30 seconds')), 30000);
      });
      
      // Race the ytdlp operation against the timeout
      let videoInfo;
      try {
        videoInfo = await Promise.race([
          ytdlp(url, ytdlpOptions),
          timeoutPromise
        ]);
      } catch (execError) {
        console.error('Error executing yt-dlp:', execError);
        
        // Try with a simpler format string as fallback
      console.log('Trying fallback with simpler format string...');
      // Ensure cookies are properly set in the fallback options
      const fallbackOptions1 = { 
        ...ytdlpOptions, 
        format: 'best',
        cookies: cookiesValid ? cookiesPath : null,
        cookiesFromBrowser: ['chrome', 'edge', 'firefox', 'opera', 'brave', 'vivaldi', 'safari'].join(',') // Try all possible browsers
      };
      try {
        videoInfo = await ytdlp(url, fallbackOptions1);
        console.log('Fallback with simpler format string succeeded');
      } catch (fallback1Error) {
        console.error('Error with first fallback:', fallback1Error);
        
        // Try with minimal options as a last resort
        console.log('Trying with minimal options as last resort...');
        const fallbackOptions2 = {
          dumpSingleJson: true,
          noWarnings: true,
          noCheckCertificate: true,
          format: 'best',
          skipDownload: true,
          cookies: cookiesValid ? cookiesPath : null,
          cookiesFromBrowser: ['chrome', 'edge', 'firefox', 'opera', 'brave', 'vivaldi', 'safari'].join(','), // Try all possible browsers
          addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0']
        };
        
        // Removed proxy setting as it was causing connection timeouts
        
        videoInfo = await ytdlp(url, fallbackOptions2);
        console.log('Last resort fallback succeeded');
      }
      }
      
      // Log the entire videoInfo object for debugging
      console.log('Video info extracted successfully');
      console.log('Video info type:', typeof videoInfo);
      
      // If videoInfo is a string, try to parse it as JSON
      if (typeof videoInfo === 'string') {
        try {
          videoInfo = JSON.parse(videoInfo);
          console.log('Successfully parsed videoInfo from string to object');
        } catch (parseError) {
          console.error('Error parsing videoInfo string:', parseError.message);
          throw new Error("Failed to parse video information. Please check the URL and try again.");
        }
      }
      
      console.log('Video info keys:', videoInfo ? Object.keys(videoInfo) : 'No keys');
      console.log('Title:', videoInfo?.title);
      console.log('Formats length:', videoInfo?.formats?.length || 'No formats');
      
      // Check if videoInfo is valid
      if (!videoInfo || typeof videoInfo !== 'object') {
        throw new Error("Invalid video information returned. Please check the URL and try again.");
      }
      
      // Extract properties with fallbacks
      const title = videoInfo.title || videoInfo.fulltitle || videoInfo.alt_title || null;
      const thumbnail = videoInfo.thumbnail || null;
      const duration = videoInfo.duration || 0;
      const formats = Array.isArray(videoInfo.formats) ? videoInfo.formats : [];
      const subtitles = videoInfo.subtitles && typeof videoInfo.subtitles === 'object' ? videoInfo.subtitles : {};
      
      if (!title) {
        throw new Error("Could not extract video title. Please check the URL and try again.");
      }

      const readableDuration = formatDuration(duration);

      const formatMap = new Map();

      const qualityOptions = [];

      // Check if formats is an array and not empty
      if (!Array.isArray(formats) || formats.length === 0) {
        console.warn("No formats found or formats is not an array");
      } else {
        console.log(`Processing ${formats.length} formats`);
        
        // First, collect all available formats
        for (const format of formats) {
          if (!format || typeof format !== 'object') {
            console.log('Skipping invalid format object');
            continue;
          }
          
          if (!format.url) {
            console.log(`Skipping format without URL: ${format.format_id || 'unknown'}`);
            continue;
          }
          
          // Determine if format has video and/or audio
          const hasVideo = format.vcodec && format.vcodec !== "none";
          const hasAudio = format.acodec && format.acodec !== "none";
          const isAudioOnly = hasAudio && !hasVideo;
          const isVideoOnly = hasVideo && !hasAudio;
          
          let formatType = "";

          // Skip m3u8/HLS formats as they're not directly downloadable and can cause issues
          // Also skip formats with no audio and no video
          const isM3u8Format = format.ext === 'm3u8' || 
              format.protocol === 'm3u8' || 
              format.protocol === 'm3u8_native' || 
              format.url?.includes('.m3u8') || 
              format.format_note?.toLowerCase()?.includes('hls') ||
              format.format?.toLowerCase()?.includes('hls') || 
              format.container === 'm3u8' || 
              format.container === 'm3u8_native' ||
              format.format_id?.toLowerCase()?.includes('m3u8') ||
              format.format_id?.toLowerCase()?.includes('hls');
              
          const hasNoCodecs = format.acodec === 'none' && format.vcodec === 'none';
          
          if (isM3u8Format || hasNoCodecs) {
            console.log(`Skipping m3u8/HLS format or format with no codecs: ${format.format_id}`);
            continue;
          }

          // Include all formats with video (with or without audio) and audio-only formats
          if (hasVideo) {
            formatType = "Video";
          } else if (isAudioOnly) {
            formatType = "Audio Only";
          } else {
            console.log(`Skipping format without audio or video: ${format.format_id}`);
            continue;
          }
          
          // Create a unique key based on resolution and extension to avoid duplicates
          // This will ensure we only keep one format per resolution/quality level
          let resolutionKey = '';
          if (hasVideo) {
            // Strongly prioritize MP4 format over others for video
            // Give MP4 formats highest priority (1), WebM second (2), and others lowest (3)
            let formatPriority = '3';
            if (format.ext === 'mp4') {
              formatPriority = '1';
            } else if (format.ext === 'webm') {
              formatPriority = '2';
            }
            resolutionKey = `${format.height}p-${formatPriority}`;
          } else {
            // For audio, prioritize m4a (for better compatibility with MP4 container)
            const audioPriority = format.ext === 'm4a' ? '1' : (format.ext === 'mp3' ? '2' : '3');
            resolutionKey = `audio-${format.abr || 0}-${audioPriority}`;
          }
          
          // Skip duplicates but log them
          if (formatMap.has(resolutionKey)) {
            console.log(`Skipping duplicate format with resolution: ${resolutionKey}`);
            continue;
          }
          formatMap.set(resolutionKey, true);

          // Create a clean, professional quality label
          let qualityLabel = "";
          
          if (hasVideo) {
            // For video formats, use only height as the quality indicator
            // Keep it simple and clean with just the resolution
            qualityLabel = format.height ? `${format.height}p` : format.format_note || "";
          } else if (isAudioOnly) {
            // For audio formats, just show the bitrate
            qualityLabel = format.abr ? `${format.abr}kbps` : "medium";
          }
          
          // If we still don't have a label, use format type
          if (qualityLabel === "") qualityLabel = formatType;

          // Format filesize to human-readable format
          let filesize = format.filesize || format.filesize_approx || null;
          let readableFilesize = null;
          
          if (filesize) {
            // Convert to MB with 2 decimal places
            readableFilesize = (filesize / (1024 * 1024)).toFixed(2) + ' MB';
          } else {
            // Provide an estimated filesize based on format type and quality
            if (hasVideo) {
              // Estimate based on resolution
              const height = format.height || 0;
              if (height >= 1080) {
                readableFilesize = '45.00 MB';
              } else if (height >= 720) {
                readableFilesize = '25.00 MB';
              } else if (height >= 480) {
                readableFilesize = '15.00 MB';
              } else {
                readableFilesize = '10.00 MB';
              }
            } else if (isAudioOnly) {
              // Estimate based on audio bitrate
              const abr = format.abr || 0;
              if (abr >= 160) {
                readableFilesize = '8.00 MB';
              } else {
                readableFilesize = '5.00 MB';
              }
            }
          }

          const formatOption = {
            formatId: format.format_id,
            quality: qualityLabel,
            filesize: filesize,
            readableFilesize: readableFilesize,
            hasAudio,
            hasVideo,
            isVideoOnly,
            isAudioOnly,
            height: format.height,
            width: format.width,
            fps: format.fps,
            vcodec: format.vcodec,
            acodec: format.acodec,
            abr: format.abr,
            url: format.url,
            // Always use mp4 for video formats and mp3 for audio formats
            ext: isAudioOnly ? "mp3" : "mp4",
            formatType
          };
          
          qualityOptions.push(formatOption);
          console.log(`Added format: ${formatType} - ${qualityLabel} - ${format.format_id}`);
        }
        
        // Filter out duplicate resolutions, keeping only one format per resolution
      const uniqueVideoFormats = [];
      const videoResolutions = new Set();
      const audioFormats = [];
      
      qualityOptions.forEach(format => {
        if (format.hasVideo) {
          const resolution = format.height ? `${format.height}p` : format.quality;
          if (!videoResolutions.has(resolution)) {
            videoResolutions.add(resolution);
            uniqueVideoFormats.push(format);
          }
        } else if (format.isAudioOnly) {
          audioFormats.push(format);
        }
      });
      
      // Clear the original array and add back only unique formats
      qualityOptions.length = 0;
      
      // Sort video formats by resolution (height) in descending order
      uniqueVideoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
      
      // Sort audio formats by bitrate in descending order
      audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
      
      // Add video formats first, then audio formats
      qualityOptions.push(...uniqueVideoFormats);
      qualityOptions.push(...audioFormats);
      
      // Add a dedicated MP3 audio option if there are audio formats available
      const bestAudioFormat = qualityOptions.find(format => format.isAudioOnly);
      if (bestAudioFormat) {
        // Create a dedicated MP3 audio option with the best audio quality
        const mp3AudioOption = {
          ...bestAudioFormat,
          formatId: `${bestAudioFormat.formatId}_mp3`,
          quality: `${bestAudioFormat.abr || 128}kbps MP3`,
          ext: 'mp3',
          formatType: 'Audio Only'
        };
        
        // Add the MP3 option at the beginning of the audio formats
        qualityOptions.push(mp3AudioOption);
      }
        
        console.log(`Total quality options after processing: ${qualityOptions.length}`);
      }

    const subtitleOptions = [];

    if (subtitles && typeof subtitles === 'object' && Object.keys(subtitles).length > 0) {
      for (const [lang, tracks] of Object.entries(subtitles)) {
        if (!Array.isArray(tracks)) continue;
        // Get language name from language code if available
        const languageName = getLanguageName(lang) || lang;
        
        tracks.forEach(track => {
          if (!track.url) return; // Skip tracks without URL
          
          // Create a descriptive label for the subtitle
          const formatLabel = track.ext ? `${track.ext.toUpperCase()}` : '';
          const nameLabel = track.name ? ` (${track.name})` : '';
          
          subtitleOptions.push({
            language: lang,
            languageName,
            name: track.name || '',
            ext: track.ext || 'vtt',
            url: track.url,
            formatLabel: formatLabel + nameLabel
          });
        });
      }
    }
    
    // Helper function to get language name from language code
    function getLanguageName(langCode) {
      const languageMap = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'pa': 'Punjabi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'or': 'Odia',
        'as': 'Assamese',
        'nl': 'Dutch',
        'tr': 'Turkish',
        'pl': 'Polish',
        'uk': 'Ukrainian',
        'vi': 'Vietnamese',
        'th': 'Thai',
        'id': 'Indonesian',
        'ms': 'Malay',
        'fil': 'Filipino',
        'sv': 'Swedish',
        'no': 'Norwegian',
        'da': 'Danish',
        'fi': 'Finnish',
        'cs': 'Czech',
        'sk': 'Slovak',
        'hu': 'Hungarian',
        'ro': 'Romanian',
        'bg': 'Bulgarian',
        'el': 'Greek',
        'he': 'Hebrew',
        'fa': 'Persian',
        'ur': 'Urdu',
        'auto': 'Auto-generated'
      };
      
      // Handle language codes with region specifiers (e.g., 'en-US')
      const baseLang = langCode.split('-')[0];
      return languageMap[langCode] || languageMap[baseLang];
    }

      return {
        title,
        thumbnail,
        duration: readableDuration,
        qualityOptions,
        subtitleOptions,
      };
    } catch (innerError) {
      console.error("Error processing video info:", innerError);
      
      // Check if the error is related to cookies or authentication
      if (innerError.message.includes("sign in") || 
          innerError.message.includes("login") || 
          innerError.message.includes("authentication") || 
          innerError.message.includes("private") ||
          innerError.message.includes("bot")) {
        console.log("Authentication or bot verification error detected, attempting last resort authentication");
        
        // Try one more time with explicit Firefox browser cookies and a different user agent
        try {
          console.log('Attempting last resort authentication with Firefox browser cookies...');
          const lastResortOptions = {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            format: 'best',
            skipDownload: true,
            cookiesFromBrowser: ['firefox', 'chrome', 'edge', 'opera', 'brave', 'vivaldi', 'safari'].join(','), // Try all possible browsers
            addHeader: ['User-Agent:Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0']
          };
          
          console.log('Using last resort options:', JSON.stringify(lastResortOptions, null, 2));
          const lastResortInfo = await ytdlp(url, lastResortOptions);
          console.log('Last resort authentication succeeded!');
          return lastResortInfo;
        } catch (lastResortError) {
          console.error('Last resort authentication also failed:', lastResortError);
          throw new Error("This video requires authentication. Please try a different URL or video.");
        }
      }
      
      throw new Error("Failed to process video information. Please try a different URL or video.");
    }
  } catch (err) {
    console.error("Error fetching video info:", err);
    
    // Log detailed error information for debugging
    if (err.stderr) {
      console.error("yt-dlp stderr output:", err.stderr);
    }
    if (err.stdout) {
      console.error("yt-dlp stdout output:", err.stdout);
    }
    if (err.code) {
      console.error("yt-dlp exit code:", err.code);
    }
    
    // Try to extract the most specific error message from stderr if available
    let errorMessage = "Failed to extract video information. Please check the URL and try again.";
    
    // Handle specific error cases
    if (err.message.includes("Video unavailable") || (err.stderr && err.stderr.includes("Video unavailable"))) {
      errorMessage = "This video is unavailable or private.";
    } else if (err.message.includes("Could not extract video title") || (err.stderr && err.stderr.includes("Could not extract"))) {
      errorMessage = "Could not extract video information. Please check if the URL is correct and the video exists.";
    } else if (err.message.includes("Invalid YouTube URL") || err.message.includes("Invalid URL provided")) {
      errorMessage = err.message;
    } else if (err.message.includes("This video is not available") || 
               err.message.includes("not available in your country") ||
               (err.stderr && err.stderr.includes("not available in your country"))) {
      errorMessage = "This video is not available in your region or has been restricted by YouTube.";
    } else if (err.message.includes("Sign in") || 
               err.message.includes("sign in") || 
               err.message.includes("login") ||
               (err.stderr && (err.stderr.includes("Sign in") || err.stderr.includes("login required")))) {
      errorMessage = "This video requires authentication. Please try a different URL or video.";
    } else if (err.message.includes("timed out") || (err.stderr && err.stderr.includes("timed out"))) {
      errorMessage = "The request timed out. YouTube might be blocking our requests or the server is overloaded.";
    } else if (err.stderr) {
      // Try to extract the most specific error message from stderr
      const errorPatterns = [
        /ERROR:\s*(.+?)(?:\n|$)/,
        /Unable to extract\s*(.+?)(?:\n|$)/,
        /\[youtube\]\s*(.+?)(?:\n|$)/,
        /\[error\]\s*(.+?)(?:\n|$)/
      ];
      
      for (const pattern of errorPatterns) {
        const match = err.stderr.match(pattern);
        if (match && match[1]) {
          errorMessage = `YouTube error: ${match[1]}`;
          break;
        }
      }
    }
    
    // Try with a different approach if it seems to be an extraction issue
    if ((err.stderr && err.stderr.includes("Unable to extract")) || 
        err.message.includes("Unable to extract") ||
        err.message.includes("Unsupported URL")) {
      
      console.log("Extraction failure detected, trying alternative approach...");
      
      try {
        // Try with a completely different set of options as a last resort
        // Check if cookies file exists and is valid
        const cookiesPath = path.resolve('./youtube-cookies.txt');
        const cookiesValid = isValidCookiesFile(cookiesPath);
        
        if (cookiesValid) {
          console.log(`Found valid cookies file at: ${cookiesPath} for last resort attempt`);
        } else {
          console.log(`Valid cookies file not found at: ${cookiesPath} for last resort attempt, will rely on browser cookies`);
        }
        
        const lastResortOptions = {
          dumpSingleJson: true,
          noWarnings: true,
          noCallHome: true,
          noCheckCertificate: true,
          format: 'best',
          skipDownload: true,
          cookies: cookiesValid ? cookiesPath : null,
          cookiesFromBrowser: ['chrome', 'edge', 'firefox', 'opera', 'brave', 'vivaldi', 'safari'].join(','), // Try all possible browsers
          addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0']
        };
        
        // Removed proxy setting as it was causing connection timeouts
        
        console.log("Trying last resort options:", JSON.stringify(lastResortOptions, null, 2));
        const lastResortInfo = await ytdlp(url, lastResortOptions);
        
        // If we get here, it worked! Process the result
        let videoInfo = lastResortInfo;
        if (typeof videoInfo === 'string') {
          videoInfo = JSON.parse(videoInfo);
        }
        
        if (videoInfo && videoInfo.title) {
          console.log("Last resort approach succeeded!");
          return {
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: formatDuration(videoInfo.duration || 0),
            qualityOptions: [{
              formatId: 'best',
              formatType: 'Video',
              quality: 'Best Quality',
              ext: videoInfo.ext || 'mp4',
              hasVideo: true,
              hasAudio: true,
              height: videoInfo.height || 720,
              width: videoInfo.width || 1280,
              fps: videoInfo.fps || 30,
              filesize: videoInfo.filesize || 0,
              readableFilesize: '10-50 MB',
              url: videoInfo.url
            }],
            subtitleOptions: []
          };
        }
      } catch (lastResortError) {
        console.error("Last resort approach also failed:", lastResortError);
      }
    }
    
    // If we got here, all approaches failed
    console.error("All extraction approaches failed");
    throw new Error(errorMessage);
  }
  });
}