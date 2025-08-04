// ytDlpHelper.js
import ytdlp from "yt-dlp-exec";
import fs from "fs";
import path from "path";

// Check if we're running in production (Render.com)
const isProduction = process.env.NODE_ENV === 'production';

// Define paths for yt-dlp and FFmpeg in production
const ytDlpPath = isProduction ? '/tmp/bin/yt-dlp' : undefined;
const ffmpegPath = isProduction ? '/tmp/bin/ffmpeg' : undefined;
const ffprobePath = isProduction ? '/tmp/bin/ffprobe' : undefined;

// Log paths for debugging
if (isProduction) {
  console.log('Using yt-dlp path:', ytDlpPath);
  console.log('Using FFmpeg path:', ffmpegPath);
  console.log('Using FFprobe path:', ffprobePath);
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

  try {
    // Check if cookies file exists
    const cookiesPath = './youtube-cookies.txt';
    const cookiesExist = fs.existsSync(cookiesPath);
    
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
      socketTimeout: 60,
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0, // best quality
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]', // Prioritize MP4 formats
      mergeOutputFormat: 'mp4', // Ensure we merge to MP4 format
      embedThumbnail: true,
      cookies: cookiesExist ? cookiesPath : null,
      addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']
    };
    
    // If in production, specify FFmpeg path and yt-dlp path
    if (isProduction) {
      ytdlpOptions.ffmpegLocation = '/tmp/bin/ffmpeg';
      ytdlpOptions.binPath = '/tmp/bin/yt-dlp';
    }
    
    console.log('Using ytdlpOptions:', JSON.stringify(ytdlpOptions, null, 2));
    console.log('Using cookies file:', cookiesExist ? cookiesPath : 'No cookies file found');

    try {
      // In production, specify the binary path
      if (isProduction) {
        console.log('Using yt-dlp binary path:', ytDlpPath);
        ytdlpOptions.binaryPath = ytDlpPath;
        ytdlpOptions.ffmpegLocation = ffmpegPath;
      }
      
      let videoInfo = await ytdlp(url, ytdlpOptions);
      
      // Log the entire videoInfo object for debugging
      console.log('Video info extracted successfully');
      console.log('Video info type:', typeof videoInfo);
      console.log('Raw videoInfo:', videoInfo);

      
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
          innerError.message.includes("private")) {
        console.log("Authentication or private video error detected, retrying with cookies");
        throw new Error("This video requires authentication. Please try a different URL or video.");
      }
      
      throw new Error("Failed to process video information. Please try a different URL or video.");
    }
  } catch (err) {
    console.error("Error fetching video info:", err);
    
    // Handle specific error cases
    if (err.message.includes("Video unavailable")) {
      throw new Error("This video is unavailable or private.");
    } else if (err.message.includes("Could not extract video title")) {
      throw new Error("Could not extract video information. Please check if the URL is correct and the video exists.");
    } else if (err.message.includes("Invalid YouTube URL") || err.message.includes("Invalid URL provided")) {
      throw new Error(err.message);
    } else if (err.stderr && err.stderr.includes("ERROR:")) {
      // Extract the specific error message from yt-dlp stderr if available
      const match = err.stderr.match(/ERROR:\s*(.+?)(?:\n|$)/);
      if (match && match[1]) {
        throw new Error(`YouTube error: ${match[1]}`);
      }
    }
    
    // Generic fallback error
    throw new Error("Failed to extract video information. Please check the URL and try again.");
  }
}