import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { create } from "yt-dlp-exec";
import path from "path";
import fs from "fs";
import fetchVideoInfo from "./ytDlpHelper.js";
import { cleanupTempFiles } from "./cleanup.js";

// Create ytdlp instance with system binary path instead of node_modules path
const ytdlp = create(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://ssyoutube.netlify.app', 'https://ssyoutube.vercel.app', 'https://downloader-frontend.netlify.app', 'https://downloader-frontend.vercel.app', 'https://downloader-frontend.onrender.com', 'https://downloader-backend-bc1x.onrender.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));

// Allow all origins in development mode
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    next();
  });
}

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

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    console.log(`[${new Date().toISOString()}] Processing download request for URL: ${url}`);
    try {
      const videoInfo = await fetchVideoInfo(url);
      console.log(`[${new Date().toISOString()}] Successfully extracted info for: ${videoInfo.title}`);
      res.json(videoInfo);
    } catch (ytdlpError) {
      console.error(`[${new Date().toISOString()}] yt-dlp error:`, ytdlpError);
      
      // Determine appropriate status code based on error type
      let statusCode = 500;
      let errorCode = 'EXTRACTION_FAILED';
      
      if (ytdlpError.message.includes('Invalid YouTube URL') || ytdlpError.message.includes('Invalid URL provided')) {
        statusCode = 400;
        errorCode = 'INVALID_URL';
      } else if (ytdlpError.message.includes('unavailable') || ytdlpError.message.includes('private')) {
        statusCode = 404;
        errorCode = 'VIDEO_UNAVAILABLE';
      } else if (ytdlpError.message.includes('region') || ytdlpError.message.includes('country')) {
        statusCode = 403;
        errorCode = 'REGION_RESTRICTED';
      } else if (ytdlpError.message.includes('authentication') || ytdlpError.message.includes('sign in') || ytdlpError.message.includes('login')) {
        statusCode = 403;
        errorCode = 'AUTHENTICATION_REQUIRED';
      } else if (ytdlpError.message.includes('timed out')) {
        statusCode = 504;
        errorCode = 'TIMEOUT';
      }
      
      res.status(statusCode).json({
        error: ytdlpError.message,
        errorCode,
        timestamp: new Date().toISOString(),
        details: ytdlpError.stderr || null
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Unexpected error in /api/download:`, error);
    res.status(500).json({
      error: 'An unexpected error occurred while processing your request',
      errorCode: 'SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
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
        let outputFilename = `./temp/${videoInfo.title.replace(/[/\:*?"<>|]/g, '_')}_${Date.now()}.mp4`;
        
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
            const fallbackOutputFilename = `./temp/${videoInfo.title.replace(/[\/\:*?"<>|]/g, '_')}_${Date.now()}_fallback.mp4`;
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
        
        // Get the server's base URL from the request
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        
        // Create the download URL using the server's base URL
        const mergedUrl = `${baseUrl}/temp/${path.basename(outputFilename)}`;
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
      urlObj.searchParams.set('filename', `${videoInfo.title.replace(/[\/\:*?"<>|]/g, '_')}.${requestedFormat.ext || 'mp3'}`);
      
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
  
  // Run initial cleanup
  cleanupTempFiles();
  
  // Schedule cleanup to run every 15 minutes
  const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  setInterval(() => {
    console.log('Running scheduled temp file cleanup...');
    cleanupTempFiles();
  }, CLEANUP_INTERVAL_MS);
  
  console.log(`Temp file cleanup scheduled to run every 15 minutes`);
});