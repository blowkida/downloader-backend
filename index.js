import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ytdlp from "yt-dlp-exec";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import fetchVideoInfo from "./ytDlpHelper.js";

// Promisify exec
const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));

// Create temp directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('Created temp directory:', tempDir);
}

// Serve static files from the temp directory
app.use('/temp', express.static(tempDir));

// Function to ensure yt-dlp is available
async function ensureYtDlp() {
  // In production (Render), the render-build.sh script should download yt-dlp to /usr/local/bin/ or /tmp/bin/
  if (isProduction) {
    // Define primary and fallback binary directories
    const primaryBinDir = '/usr/local/bin';
    const fallbackBinDir = '/tmp/bin';
    
    // Define paths for binaries and setup flags
    const primaryYtDlpPath = `${primaryBinDir}/yt-dlp`;
    const primaryFfmpegPath = `${primaryBinDir}/ffmpeg`;
    const fallbackYtDlpPath = `${fallbackBinDir}/yt-dlp`;
    const fallbackFfmpegPath = `${fallbackBinDir}/ffmpeg`;
    
    // Check if binaries exist in primary directory
    const primaryYtDlpExists = fs.existsSync(primaryYtDlpPath);
    const primaryFfmpegExists = fs.existsSync(primaryFfmpegPath);
    
    // Check if binaries exist in fallback directory
    const fallbackYtDlpExists = fs.existsSync(fallbackYtDlpPath);
    const fallbackFfmpegExists = fs.existsSync(fallbackFfmpegPath);
    
    console.log('Checking binary availability:');
    console.log(`- Primary yt-dlp (${primaryYtDlpPath}): ${primaryYtDlpExists ? 'Found' : 'Not found'}`);
    console.log(`- Primary FFmpeg (${primaryFfmpegPath}): ${primaryFfmpegExists ? 'Found' : 'Not found'}`);
    console.log(`- Fallback yt-dlp (${fallbackYtDlpPath}): ${fallbackYtDlpExists ? 'Found' : 'Not found'}`);
    console.log(`- Fallback FFmpeg (${fallbackFfmpegPath}): ${fallbackFfmpegExists ? 'Found' : 'Not found'}`);
    
    // If binaries exist in either location, we're good to go
    const ytDlpExists = primaryYtDlpExists || fallbackYtDlpExists;
    const ffmpegExists = primaryFfmpegExists || fallbackFfmpegExists;
    
    if (ytDlpExists && ffmpegExists) {
      console.log('yt-dlp and FFmpeg are available');
      return;
    }
    
    // If we're here, we need to set up yt-dlp and FFmpeg
    console.log('yt-dlp or FFmpeg not found, setting up...');
    
    try {
      // Create fallback directory if it doesn't exist
      if (!fs.existsSync(fallbackBinDir)) {
        try {
          fs.mkdirSync(fallbackBinDir, { recursive: true });
          console.log(`Created ${fallbackBinDir} directory`);
        } catch (fallbackDirError) {
          console.error(`Failed to create ${fallbackBinDir} directory:`, fallbackDirError.message);
        }
      }
      
      // Install yt-dlp if needed
      if (!ytDlpExists) {
        console.log('Installing yt-dlp...');
        try {
          // Direct download to fallback directory
          await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${fallbackYtDlpPath}`);
          await execAsync(`chmod +x ${fallbackYtDlpPath}`);
          console.log(`yt-dlp downloaded to ${fallbackBinDir} and made executable`);
          
          // Verify yt-dlp works
          try {
            const { stdout } = await execAsync(`${fallbackYtDlpPath} --version`);
            console.log('yt-dlp version:', stdout.trim());
          } catch (verifyError) {
            console.warn('yt-dlp verification failed:', verifyError.message);
          }
        } catch (dlError) {
          console.error(`Failed to download yt-dlp:`, dlError.message);
          console.warn('yt-dlp installation failed, but will continue execution');
        }
      }
      
      // Install FFmpeg if needed
      if (!ffmpegExists) {
        console.log('Installing FFmpeg...');
        try {
          // Download to /tmp
          await execAsync('curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz');
          await execAsync('mkdir -p /tmp/ffmpeg');
          await execAsync('tar xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1');
          
          // Copy to fallback directory
          await execAsync(`cp /tmp/ffmpeg/ffmpeg ${fallbackFfmpegPath}`);
          await execAsync(`cp /tmp/ffmpeg/ffprobe ${fallbackBinDir}/ffprobe`);
          await execAsync(`chmod +x ${fallbackFfmpegPath} ${fallbackBinDir}/ffprobe`);
          console.log(`FFmpeg and FFprobe copied to ${fallbackBinDir}`);
          
          // Clean up temporary files
          await execAsync('rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg');
          
          // Verify FFmpeg works
          try {
            const { stdout } = await execAsync(`${fallbackFfmpegPath} -version`);
            console.log('FFmpeg version info:', stdout.split('\n')[0]);
          } catch (verifyError) {
            console.warn('FFmpeg verification failed:', verifyError.message);
          }
        } catch (ffmpegError) {
          console.error('Failed to download or extract FFmpeg:', ffmpegError.message);
          console.warn('FFmpeg installation failed, but will continue execution');
        }
      }
      
      // Update PATH to include fallback directory
      process.env.PATH = `${fallbackBinDir}:${process.env.PATH}`;
      console.log(`Updated PATH to include ${fallbackBinDir}`);
      
      // Set FFmpeg paths for child processes
      if (fs.existsSync(fallbackFfmpegPath)) {
        process.env.FFMPEG_PATH = fallbackFfmpegPath;
        process.env.FFPROBE_PATH = `${fallbackBinDir}/ffprobe`;
        console.log(`Set FFMPEG_PATH to ${fallbackFfmpegPath} and FFPROBE_PATH to ${fallbackBinDir}/ffprobe`);
      }
    } catch (error) {
      console.error('Error setting up yt-dlp or FFmpeg:', error);
      console.log('Application will continue, but video downloads may fail');
    }
  }
}

// Call this before starting the server
ensureYtDlp().catch(error => {
  console.error('Failed to ensure yt-dlp availability:', error);
  // Continue starting the server even if setup fails - we'll handle errors on download requests
});

// Configure yt-dlp with paths if in production
if (isProduction) {
  // Update PATH environment variable to include /tmp/bin
  process.env.PATH = `/tmp/bin:${process.env.PATH}`;
  console.log('Updated PATH environment variable:', process.env.PATH);
  
  // Set environment variables for FFmpeg paths
  process.env.FFMPEG_PATH = '/tmp/bin/ffmpeg';
  process.env.FFPROBE_PATH = '/tmp/bin/ffprobe';
  
  // Log the paths for debugging
  console.log('FFmpeg path:', process.env.FFMPEG_PATH);
  console.log('FFprobe path:', process.env.FFPROBE_PATH);
  
  // yt-dlp-exec doesn't have setBinaryPath method, so we'll set options directly in the command calls
}

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const videoInfo = await fetchVideoInfo(url);
    res.json(videoInfo);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: error.message || "Server error occurred." });
  }
});

// Endpoint to download merged high-resolution video with audio
app.post("/api/download/merged", async (req, res) => {
  const { url, videoFormatId } = req.body;
  
  if (!url) return res.status(400).json({ error: "No URL provided" });
  if (!videoFormatId) return res.status(400).json({ error: "No video format ID provided" });
  
  try {
    // Get video info to extract the direct download URL
    const videoInfo = await fetchVideoInfo(url);
    
    // Find the format that matches the requested format ID
    const requestedFormat = videoInfo.qualityOptions.find(format => format.formatId === videoFormatId);
    
    if (!requestedFormat) {
      throw new Error(`Format with ID ${videoFormatId} not found`);
    }
    
    // For all video formats, we'll always download and merge with audio to ensure best quality
    // This handles video-only formats, m3u8/HLS formats, and regular video formats
    if (requestedFormat.hasVideo) {
      console.log(`Format ${videoFormatId} is being processed for download`);
      
      try {
        // Generate a unique output filename with timestamp
        let outputFilename = `./temp/${videoInfo.title.replace(/[\/\:*?"<>|]/g, '_')}_${Date.now()}.mp4`;
        
        // Always attempt to merge video and audio
        try {
          console.log("Attempting to download and merge with best audio quality...");
          // FIX: Modified the format string to ensure we get both video and audio
          // The key change is using bestvideo+bestaudio format selector to ensure we get separate streams
          // and then merge them with ffmpeg
          const ytdlpDownloadOptions = {
            format: `${videoFormatId}+bestaudio[ext=m4a]/best`, // Use specified videoFormatId + best audio
            mergeOutputFormat: 'mp4',
            output: outputFilename,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: false,
            referer: 'https://www.youtube.com/',
            addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
            // Adding verbose output for debugging
            verbose: true
          };
          
          // If in production, specify FFmpeg path
          if (isProduction) {
            ytdlpDownloadOptions.ffmpegLocation = '/tmp/bin/ffmpeg';
            // Use the binary directly from the PATH with custom binary path
            ytdlpDownloadOptions.binaryPath = '/tmp/bin/yt-dlp';
            console.log('Using yt-dlp binary path:', ytdlpDownloadOptions.binaryPath);
            console.log('Using FFmpeg path:', ytdlpDownloadOptions.ffmpegLocation);
          }
          
          // Execute yt-dlp to download and merge the video
          console.log(`Executing yt-dlp with options: ${JSON.stringify(ytdlpDownloadOptions, null, 2)}`);
          await ytdlp(url, ytdlpDownloadOptions);
          console.log('Video downloaded and merged to:', outputFilename);
          
          // Check if the file was created successfully
          if (!fs.existsSync(outputFilename)) {
            throw new Error('Failed to create output file - FFmpeg might not be installed');
          }
        } catch (mergeError) {
          console.error('Error during merge attempt:', mergeError);
          
          // Fallback to downloading just the video format without merging
          console.log('Attempting fallback to direct video download without merging...');
          try {
            // Create fallback download options for best video format in MP4
            const fallbackOutputFilename = `./temp/${videoInfo.title.replace(/[/\:*?"<>|]/g, '_')}_${Date.now()}_fallback.mp4`;
            const fallbackOptions = {
              // FIX: Include bestaudio in the fallback as well to make sure we get audio
              format: `bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
              output: fallbackOutputFilename,
              mergeOutputFormat: 'mp4', // Ensure we're still trying to merge to mp4
              noWarnings: true,
              noCallHome: true,
              noCheckCertificate: true,
              preferFreeFormats: true,
              youtubeSkipDashManifest: false,
              referer: 'https://www.youtube.com/',
              addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
              // Adding verbose output for debugging
              verbose: true
            };
            
            // If in production, specify FFmpeg path
            if (isProduction) {
              fallbackOptions.ffmpegLocation = '/tmp/bin/ffmpeg';
              // Use the binary directly from the PATH with custom binary path
              fallbackOptions.binaryPath = '/tmp/bin/yt-dlp';
              console.log('Using fallback yt-dlp binary path:', fallbackOptions.binaryPath);
              console.log('Using fallback FFmpeg path:', fallbackOptions.ffmpegLocation);
            }
            
            // Execute yt-dlp to download just the video
            console.log(`Executing fallback yt-dlp with options: ${JSON.stringify(fallbackOptions, null, 2)}`);
            await ytdlp(url, fallbackOptions);
            console.log('Video downloaded without merging to:', fallbackOutputFilename);
            
            // Check if the fallback file was created successfully
            if (!fs.existsSync(fallbackOutputFilename)) {
              throw new Error('Failed to create fallback output file');
            }
            
            // Update the output filename to the fallback one
            outputFilename = fallbackOutputFilename;
          } catch (fallbackError) {
            console.error('Fallback download also failed:', fallbackError);
            throw new Error(`Both merge and fallback download failed. Original error: ${mergeError.message}`);
          }
        }
        
        // Serve the file directly
        const mergedUrl = `http://localhost:${PORT}/temp/${path.basename(outputFilename)}`;
        console.log('Serving merged file from:', mergedUrl);
        
        // Create a URL object to add parameters
        const urlObj = new URL(mergedUrl.trim());
        
        // Add the video title as a parameter for proper filename
        urlObj.searchParams.set('title', videoInfo.title);
        urlObj.searchParams.set('filename', `${videoInfo.title.replace(/[\/\:*?"<>|]/g, '_')}.mp4`);
        
        // Add a timestamp to prevent caching issues
        urlObj.searchParams.set('_t', Date.now());
        
        // Return the merged download URL with proper parameters
        res.json({ 
          success: true, 
          message: `Download merged format ${videoFormatId}`,
          downloadUrl: urlObj.toString(),
          title: videoInfo.title,
          fileSize: requestedFormat.readableFilesize || 'Unknown',
          ext: 'mp4'
        });
        return;
      } catch (mergeError) {
        console.error('Error downloading and merging video:', mergeError);
        throw new Error(`Failed to process video: ${mergeError.message}`);
      }
    } else {
      // For audio-only formats, use direct URL
      let downloadUrl = requestedFormat.url;
      
      // Ensure the URL includes the video title for proper filename
      const urlObj = new URL(downloadUrl);
      
      // Add or update parameters for proper download
      urlObj.searchParams.set('title', videoInfo.title);
      urlObj.searchParams.set('filename', `${videoInfo.title.replace(/[\/:*?"<>|]/g, '_')}.${requestedFormat.ext || 'mp3'}`);
      
      // Add a timestamp to prevent caching issues
      urlObj.searchParams.set('_t', Date.now());
      
      // Add download parameter to force download
      urlObj.searchParams.set('download', '1');
      
      // Return the direct download URL with proper parameters
      res.json({ 
        success: true, 
        message: `Download format ${videoFormatId}`,
        downloadUrl: urlObj.toString(),
        title: videoInfo.title,
        fileSize: requestedFormat.readableFilesize || 'Unknown',
        ext: requestedFormat.ext || 'mp3'
      });
    }
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: error.message || "Error preparing download." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});