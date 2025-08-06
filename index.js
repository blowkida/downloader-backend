import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import fetchVideoInfo, { findValidCookiesFile, isValidCookiesFile, ytdlp } from "./ytDlpHelper.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://ssyoutube.netlify.app', 'https://ssyoutube.vercel.app', 'https://downloader-frontend.netlify.app', 'https://downloader-frontend.vercel.app', 'https://downloader-frontend.onrender.com', 'https://downloader-backend-bc1x.onrender.com', '*'],
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

// Add a health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.headers.origin);
  console.log('Request headers:', req.headers);
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Helper function to handle errors
function handleError(res, error) {
  console.error('Error:', error.message);
  
  // Provide a more user-friendly message for ENOENT errors
  if (error.code === 'ENOENT') {
    return res.status(500).json({
      error: 'yt-dlp binary not found. Please make sure yt-dlp is installed correctly.',
      details: 'Run "npm run install-yt-dlp" to automatically install yt-dlp.'
    });
  }
  
  res.status(500).json({ error: error.message });
}

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
    handleError(res, error);
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
          // Find and validate cookies file
           const cookiesResult = findValidCookiesFile();
           const { cookiesExist, cookiesValid, cookiesPath } = cookiesResult;
           
           if (cookiesExist && cookiesValid) {
             console.log(`Using valid cookies file from ${cookiesPath} for download`);
           }
          
          const ytdlpDownloadOptions = {
            format: `${videoFormatId}+bestaudio[ext=m4a]/best`, // Use specified videoFormatId + best audio
            mergeOutputFormat: 'mp4',
            output: outputFilename,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: false,
            socketTimeout: 120, // Socket timeout in seconds
            referer: 'https://www.youtube.com/',
            addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
            // Adding verbose output for debugging
            verbose: true
          };
          
          // Add cookies if available
          if (cookiesExist && cookiesValid) {
            ytdlpDownloadOptions.cookies = cookiesPath;
          }
          
          // Execute yt-dlp to download and merge the video with retry mechanism
          console.log(`Executing yt-dlp with options: ${JSON.stringify(ytdlpDownloadOptions, null, 2)}`);
          
          // Retry mechanism for 403 errors
          const MAX_RETRIES = 2;
          let retryCount = 0;
          let downloadSuccess = false;
          
          while (!downloadSuccess && retryCount <= MAX_RETRIES) {
            try {
              await ytdlp(url, ytdlpDownloadOptions);
              downloadSuccess = true;
              console.log('Video downloaded and merged to:', outputFilename);
            } catch (downloadError) {
              if (downloadError.message.includes('HTTP Error 403: Forbidden') || 
                  (downloadError.stderr && downloadError.stderr.includes('HTTP Error 403: Forbidden'))) {
                retryCount++;
                if (retryCount <= MAX_RETRIES) {
                  console.log(`Download encountered 403 Forbidden error. Retrying (${retryCount}/${MAX_RETRIES})...`);
                  // Wait before retrying (exponential backoff)
                  const waitTime = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s, etc.
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                  throw downloadError; // Max retries exceeded, propagate the error
                }
              } else {
                throw downloadError; // Not a 403 error, propagate it
              }
            }
          }
          
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
              socketTimeout: 120, // Socket timeout in seconds
              referer: 'https://www.youtube.com/',
              addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
              // Adding verbose output for debugging
              verbose: true
            };
            
            // Add cookies if available
            if (cookiesExist && cookiesValid) {
              fallbackOptions.cookies = cookiesPath;
              console.log(`Using valid cookies file from ${cookiesPath} for fallback download`);
            }
            
            // Execute yt-dlp to download just the video with retry mechanism
            console.log(`Executing fallback yt-dlp with options: ${JSON.stringify(fallbackOptions, null, 2)}`);
            
            // Retry mechanism for 403 errors
            const MAX_RETRIES = 2;
            let retryCount = 0;
            let downloadSuccess = false;
            
            while (!downloadSuccess && retryCount <= MAX_RETRIES) {
              try {
                await ytdlp(url, fallbackOptions);
                downloadSuccess = true;
                console.log('Video downloaded without merging to:', fallbackOutputFilename);
              } catch (downloadError) {
                if (downloadError.message.includes('HTTP Error 403: Forbidden') || 
                    (downloadError.stderr && downloadError.stderr.includes('HTTP Error 403: Forbidden'))) {
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    console.log(`Fallback download encountered 403 Forbidden error. Retrying (${retryCount}/${MAX_RETRIES})...`);
                    // Wait before retrying (exponential backoff)
                    const waitTime = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s, etc.
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                  } else {
                    throw downloadError; // Max retries exceeded, propagate the error
                  }
                } else {
                  throw downloadError; // Not a 403 error, propagate it
                }
              }
            }
            
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
        const host = req.get('host');
        const protocol = req.protocol;
        const mergedUrl = `${protocol}://${host}/temp/${path.basename(outputFilename)}`;
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
    console.error("Error stack:", error.stack);
    console.error("Request headers:", req.headers);
    console.error("Request origin:", req.headers.origin);
    res.status(500).json({ error: error.message || "Error preparing download." });
  }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './'); // Store in the current directory
  },
  filename: function (req, file, cb) {
    cb(null, 'youtube-cookies.txt'); // Always save as youtube-cookies.txt
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only text files
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only text files are allowed'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 // 1MB max file size
  }
});

// Endpoint to check cookies status
app.get("/api/cookies/status", (req, res) => {
  try {
    const cookiesResult = findValidCookiesFile();
    const { cookiesExist, cookiesValid, cookiesPath, checkedPaths } = cookiesResult;
    
    res.json({
      success: true,
      cookiesExist,
      cookiesValid,
      cookiesPath: cookiesValid ? cookiesPath : null,
      checkedPaths,
      message: cookiesValid 
        ? `Valid cookies file found at ${cookiesPath}` 
        : (cookiesExist 
            ? `Cookies file found at ${cookiesPath} but it is not valid` 
            : `No cookies file found. Checked paths: ${checkedPaths.join(', ')}`)
    });
  } catch (error) {
    console.error("Error checking cookies status:", error);
    res.status(500).json({ error: error.message || "Error checking cookies status." });
  }
});

// Endpoint to upload cookies file
app.post("/api/cookies/upload", upload.single('cookiesFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded. Please upload a valid cookies file." 
      });
    }
    
    const filePath = req.file.path;
    const isValid = isValidCookiesFile(filePath);
    
    if (!isValid) {
      // If the file is not valid, delete it to avoid using an invalid file
      try {
        fs.unlinkSync(filePath);
      } catch (deleteError) {
        console.error("Error deleting invalid cookies file:", deleteError);
      }
      
      return res.status(400).json({ 
        success: false, 
        message: "The uploaded file is not a valid Netscape HTTP Cookie File. Please make sure you're exporting cookies correctly." 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Cookies file uploaded and validated successfully.",
      filePath
    });
  } catch (error) {
    console.error("Error uploading cookies file:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Error uploading cookies file." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});