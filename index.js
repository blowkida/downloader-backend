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
  // In production (Render), the render-build.sh script should download yt-dlp to /tmp/bin/
  // But we need to handle the case where the app starts before the script completes
  if (isProduction) {
    const ytDlpPath = '/tmp/bin/yt-dlp';
    const ffmpegPath = '/tmp/bin/ffmpeg';
    const setupFlagPath = '/tmp/bin/setup_complete';
    
    // Check if setup_complete flag exists
    if (fs.existsSync(setupFlagPath)) {
      console.log('yt-dlp and FFmpeg already set up');
      return;
    }
    
    // Wait for yt-dlp to be available (max 30 seconds)
    console.log('Waiting for yt-dlp to be available...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      if (fs.existsSync(ytDlpPath) && fs.existsSync(ffmpegPath)) {
        console.log('yt-dlp and FFmpeg found!');
        return;
      }
      
      console.log(`Waiting for yt-dlp... (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
    }
    
    // If we're here, we need to set up yt-dlp and FFmpeg ourselves
    console.log('yt-dlp or FFmpeg not found after waiting, setting up manually...');
    
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync('/tmp/bin')) {
        fs.mkdirSync('/tmp/bin', { recursive: true });
      }
      
      // Download yt-dlp
      await execAsync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/bin/yt-dlp');
      await execAsync('chmod +x /tmp/bin/yt-dlp');
      console.log('yt-dlp downloaded and made executable');
      
      // Download FFmpeg (only if needed)
      if (!fs.existsSync('/tmp/bin/ffmpeg')) {
        console.log('Downloading FFmpeg...');
        await execAsync('curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz');
        await execAsync('mkdir -p /tmp/ffmpeg');
        await execAsync('tar xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1');
        await execAsync('cp /tmp/ffmpeg/ffmpeg /tmp/bin/');
        await execAsync('cp /tmp/ffmpeg/ffprobe /tmp/bin/');
        await execAsync('chmod +x /tmp/bin/ffmpeg');
        await execAsync('chmod +x /tmp/bin/ffprobe');
        await execAsync('rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg');
        console.log('FFmpeg downloaded and made executable');
      }
      
      // Create flag file
      fs.writeFileSync(setupFlagPath, 'setup complete');
      console.log('Setup complete flag created');
    } catch (error) {
      console.error('Error setting up yt-dlp or FFmpeg:', error);
      throw new Error('Failed to set up yt-dlp or FFmpeg');
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
  // Update yt-dlp configuration to use specific paths
  process.env.PATH = `/tmp/bin:${process.env.PATH}`;
  ytdlp.setBinaryPath('/tmp/bin/yt-dlp');
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