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
    const primarySetupFlagPath = `${primaryBinDir}/setup_complete`;
    
    const fallbackYtDlpPath = `${fallbackBinDir}/yt-dlp`;
    const fallbackFfmpegPath = `${fallbackBinDir}/ffmpeg`;
    const fallbackSetupFlagPath = `${fallbackBinDir}/setup_complete`;
    
    const tmpSetupFlagPath = '/tmp/setup_complete';
    
    // Check if binaries exist in primary directory
    const primaryYtDlpExists = fs.existsSync(primaryYtDlpPath);
    const primaryFfmpegExists = fs.existsSync(primaryFfmpegPath);
    
    // Check if binaries exist in fallback directory
    const fallbackYtDlpExists = fs.existsSync(fallbackYtDlpPath);
    const fallbackFfmpegExists = fs.existsSync(fallbackFfmpegPath);
    
    // Check if setup flag exists in any location
    const setupFlagExists = fs.existsSync(primarySetupFlagPath) || 
                           fs.existsSync(fallbackSetupFlagPath) || 
                           fs.existsSync(tmpSetupFlagPath);
    
    console.log('Checking setup flag in all locations:');
    console.log(`- ${primarySetupFlagPath}: ${fs.existsSync(primarySetupFlagPath) ? 'Found' : 'Not found'}`);
    console.log(`- ${fallbackSetupFlagPath}: ${fs.existsSync(fallbackSetupFlagPath) ? 'Found' : 'Not found'}`);
    console.log(`- ${tmpSetupFlagPath}: ${fs.existsSync(tmpSetupFlagPath) ? 'Found' : 'Not found'}`);
    console.log(`- Combined result: ${setupFlagExists ? 'Setup flag found' : 'No setup flag found'}`);

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
      
      // Create setup flag if it doesn't exist
      if (!setupFlagExists) {
        // Try primary directory first
        try {
          fs.writeFileSync(primarySetupFlagPath, 'setup complete');
          console.log(`Created setup complete flag in ${primaryBinDir}`);
        } catch (primaryError) {
          console.warn(`Could not create setup flag in ${primaryBinDir}:`, primaryError.message);
          
          // Try fallback directory
          try {
            fs.writeFileSync(fallbackSetupFlagPath, 'setup complete');
            console.log(`Created setup complete flag in ${fallbackBinDir}`);
          } catch (fallbackError) {
            console.warn(`Could not create setup flag in ${fallbackBinDir}:`, fallbackError.message);
            
            // Try /tmp as last resort
            try {
              fs.writeFileSync(tmpSetupFlagPath, 'setup complete');
              console.log('Created setup complete flag in /tmp');
            } catch (tmpError) {
              console.warn('Could not create setup flag in /tmp either:', tmpError.message);
              // Continue anyway since binaries exist
            }
          }
        }
      }
      
      return;
    }
    
    // No waiting loop - immediately proceed to manual setup if binaries not found
    
    // If we're here, we need to set up yt-dlp and FFmpeg ourselves
    console.log('yt-dlp or FFmpeg not found, setting up manually...');
    
    try {
      // Define primary and fallback binary directories
      const primaryBinDir = '/usr/local/bin';
      const fallbackBinDir = '/tmp/bin';
      
      // Create directories if they don't exist
      let primaryDirCreated = false;
      let fallbackDirCreated = false;
      
      // Try to create primary directory first
      try {
        await execAsync(`sudo mkdir -p ${primaryBinDir}`);
        await execAsync(`sudo chmod 755 ${primaryBinDir}`);
        console.log(`Created ${primaryBinDir} directory`);
        primaryDirCreated = true;
      } catch (primaryDirError) {
        console.error(`Failed to create ${primaryBinDir} directory:`, primaryDirError.message);
        console.log('Will attempt to use fallback directory');
      }
      
      // Always try to create fallback directory
      if (!fs.existsSync(fallbackBinDir)) {
        try {
          fs.mkdirSync(fallbackBinDir, { recursive: true });
          console.log(`Created ${fallbackBinDir} directory`);
          fallbackDirCreated = true;
        } catch (fallbackDirError) {
          console.error(`Failed to create ${fallbackBinDir} directory:`, fallbackDirError.message);
          
          if (!primaryDirCreated) {
            console.error('Failed to create both binary directories, will attempt to use existing directories');
          }
        }
      } else {
        fallbackDirCreated = true;
      }
      
      // Install yt-dlp if needed
      const primaryYtDlpPath = `${primaryBinDir}/yt-dlp`;
      const fallbackYtDlpPath = `${fallbackBinDir}/yt-dlp`;
      
      if (!fs.existsSync(primaryYtDlpPath) && !fs.existsSync(fallbackYtDlpPath)) {
        console.log('Installing yt-dlp...');
        let ytDlpInstalled = false;
        
        // First attempt - direct download to primary directory
        if (primaryDirCreated) {
          try {
            await execAsync(`sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${primaryYtDlpPath}`);
            await execAsync(`sudo chmod +x ${primaryYtDlpPath}`);
            console.log(`yt-dlp downloaded to ${primaryBinDir} and made executable`);
            
            // Verify yt-dlp works
            try {
              const { stdout } = await execAsync(`${primaryYtDlpPath} --version`);
              console.log('yt-dlp version:', stdout.trim());
              ytDlpInstalled = true;
              
              // Create a copy in fallback directory for compatibility
              if (fallbackDirCreated) {
                await execAsync(`cp ${primaryYtDlpPath} ${fallbackYtDlpPath} || ln -sf ${primaryYtDlpPath} ${fallbackYtDlpPath}`);
                await execAsync(`chmod +x ${fallbackYtDlpPath}`);
                console.log(`Created copy of yt-dlp in ${fallbackBinDir} for compatibility`);
              }
            } catch (verifyError) {
              console.warn('yt-dlp verification failed:', verifyError.message);
            }
          } catch (primaryDlError) {
            console.error(`Failed to download yt-dlp to ${primaryBinDir}:`, primaryDlError.message);
          }
        }
        
        // Second attempt - direct download to fallback directory
        if (!ytDlpInstalled && fallbackDirCreated) {
          try {
            await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${fallbackYtDlpPath}`);
            await execAsync(`chmod +x ${fallbackYtDlpPath}`);
            console.log(`yt-dlp downloaded to ${fallbackBinDir} and made executable`);
            
            // Verify yt-dlp works
            try {
              const { stdout } = await execAsync(`${fallbackYtDlpPath} --version`);
              console.log('yt-dlp version:', stdout.trim());
              ytDlpInstalled = true;
              
              // Try to create a copy in primary directory
              if (primaryDirCreated) {
                try {
                  await execAsync(`sudo cp ${fallbackYtDlpPath} ${primaryYtDlpPath} || sudo ln -sf ${fallbackYtDlpPath} ${primaryYtDlpPath}`);
                  await execAsync(`sudo chmod +x ${primaryYtDlpPath}`);
                  console.log(`Created copy of yt-dlp in ${primaryBinDir}`);
                } catch (copyError) {
                  console.warn(`Failed to copy yt-dlp to ${primaryBinDir}:`, copyError.message);
                }
              }
            } catch (verifyError) {
              console.warn('yt-dlp verification failed:', verifyError.message);
            }
          } catch (fallbackDlError) {
            console.error(`Failed to download yt-dlp to ${fallbackBinDir}:`, fallbackDlError.message);
          }
        }
        
        // Third attempt - download to current directory then move
        if (!ytDlpInstalled) {
          try {
            console.log('Trying to download yt-dlp to current directory...');
            await execAsync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp');
            await execAsync('chmod +x ./yt-dlp');
            
            // Try to copy to primary directory first
            if (primaryDirCreated) {
              try {
                await execAsync(`sudo cp ./yt-dlp ${primaryYtDlpPath} || sudo mv ./yt-dlp ${primaryYtDlpPath}`);
                await execAsync(`sudo chmod +x ${primaryYtDlpPath}`);
                console.log(`yt-dlp copied to ${primaryBinDir}`);
                ytDlpInstalled = true;
                
                // Create a copy in fallback directory for compatibility
                if (fallbackDirCreated) {
                  await execAsync(`cp ${primaryYtDlpPath} ${fallbackYtDlpPath} || ln -sf ${primaryYtDlpPath} ${fallbackYtDlpPath}`);
                  await execAsync(`chmod +x ${fallbackYtDlpPath}`);
                  console.log(`Created copy of yt-dlp in ${fallbackBinDir} for compatibility`);
                }
              } catch (primaryMoveError) {
                console.error(`Failed to copy yt-dlp to ${primaryBinDir}:`, primaryMoveError.message);
              }
            }
            
            // Try fallback directory if primary failed
            if (!ytDlpInstalled && fallbackDirCreated) {
              try {
                await execAsync(`cp ./yt-dlp ${fallbackYtDlpPath} || mv ./yt-dlp ${fallbackYtDlpPath}`);
                await execAsync(`chmod +x ${fallbackYtDlpPath}`);
                console.log(`yt-dlp copied to ${fallbackBinDir}`);
                ytDlpInstalled = true;
              } catch (fallbackMoveError) {
                console.error(`Failed to copy yt-dlp to ${fallbackBinDir}:`, fallbackMoveError.message);
              }
            }
          } catch (localDlError) {
            console.error('Failed to download yt-dlp to current directory:', localDlError.message);
          }
        }
              ytDlpInstalled = true;
            } catch (moveError) {
              console.error('Failed to move yt-dlp to /tmp/bin:', moveError.message);
            }
          } catch (localDlError) {
            console.error('Failed to download yt-dlp to current directory:', localDlError.message);
          }
          
          // Third attempt - try using npm to install yt-dlp globally
          if (!ytDlpInstalled) {
            try {
              console.log('Trying to install yt-dlp via npm...');
              await execAsync('npm install -g yt-dlp');
              console.log('yt-dlp installed via npm');
              
              // Try to find the global installation and link it
              try {
                const { stdout: npmBinPath } = await execAsync('npm bin -g');
                const globalYtDlpPath = path.join(npmBinPath.trim(), 'yt-dlp');
                
                if (fs.existsSync(globalYtDlpPath)) {
                  console.log(`Found global yt-dlp at ${globalYtDlpPath}`);
                  
                  // Try to copy to primary directory first
                  if (primaryDirCreated) {
                    try {
                      await execAsync(`sudo cp ${globalYtDlpPath} ${primaryYtDlpPath} || sudo ln -sf ${globalYtDlpPath} ${primaryYtDlpPath}`);
                      await execAsync(`sudo chmod +x ${primaryYtDlpPath}`);
                      console.log(`Created copy or symlink of yt-dlp in ${primaryBinDir}`);
                      ytDlpInstalled = true;
                      
                      // Create a copy in fallback directory for compatibility
                      if (fallbackDirCreated) {
                        await execAsync(`cp ${primaryYtDlpPath} ${fallbackYtDlpPath} || ln -sf ${primaryYtDlpPath} ${fallbackYtDlpPath}`);
                        await execAsync(`chmod +x ${fallbackYtDlpPath}`);
                        console.log(`Created copy of yt-dlp in ${fallbackBinDir} for compatibility`);
                      }
                    } catch (primaryLinkError) {
                      console.error(`Failed to create copy or symlink to ${primaryBinDir}:`, primaryLinkError.message);
                    }
                  }
                  
                  // Try fallback directory if primary failed
                  if (!ytDlpInstalled && fallbackDirCreated) {
                    try {
                      await execAsync(`cp ${globalYtDlpPath} ${fallbackYtDlpPath} || ln -sf ${globalYtDlpPath} ${fallbackYtDlpPath}`);
                      await execAsync(`chmod +x ${fallbackYtDlpPath}`);
                      console.log(`Created copy or symlink of yt-dlp in ${fallbackBinDir}`);
                      ytDlpInstalled = true;
                    } catch (fallbackLinkError) {
                      console.error(`Failed to create copy or symlink to ${fallbackBinDir}:`, fallbackLinkError.message);
                    }
                  }
                }
              } catch (npmBinError) {
                console.error('Failed to find npm global bin path:', npmBinError.message);
              }
            } catch (npmError) {
              console.error('Failed to install yt-dlp via npm:', npmError.message);
            }
          }
        }
        
        if (!ytDlpInstalled) {
          console.warn('All yt-dlp installation methods failed, but will continue execution');
          // Don't throw an error, let the application continue and handle errors during download
        }
      }
      
      // Install FFmpeg if needed
      const primaryFfmpegPath = `${primaryBinDir}/ffmpeg`;
      const primaryFfprobePath = `${primaryBinDir}/ffprobe`;
      const fallbackFfmpegPath = `${fallbackBinDir}/ffmpeg`;
      const fallbackFfprobePath = `${fallbackBinDir}/ffprobe`;
      
      if ((!fs.existsSync(primaryFfmpegPath) && !fs.existsSync(fallbackFfmpegPath)) || 
          (!fs.existsSync(primaryFfprobePath) && !fs.existsSync(fallbackFfprobePath))) {
        console.log('Installing FFmpeg...');
        let ffmpegInstalled = false;
        
        try {
          // First attempt - download to /tmp
          await execAsync('curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz');
          await execAsync('mkdir -p /tmp/ffmpeg');
          await execAsync('tar xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1');
          
          // Try to copy to primary directory first
          if (primaryDirCreated) {
            try {
              await execAsync(`sudo cp /tmp/ffmpeg/ffmpeg ${primaryFfmpegPath}`);
              await execAsync(`sudo cp /tmp/ffmpeg/ffprobe ${primaryFfprobePath}`);
              await execAsync(`sudo chmod +x ${primaryFfmpegPath} ${primaryFfprobePath}`);
              console.log(`FFmpeg and FFprobe copied to ${primaryBinDir}`);
              ffmpegInstalled = true;
              
              // Create copies in fallback directory for compatibility
              if (fallbackDirCreated) {
                await execAsync(`cp ${primaryFfmpegPath} ${fallbackFfmpegPath} || ln -sf ${primaryFfmpegPath} ${fallbackFfmpegPath}`);
                await execAsync(`cp ${primaryFfprobePath} ${fallbackFfprobePath} || ln -sf ${primaryFfprobePath} ${fallbackFfprobePath}`);
                await execAsync(`chmod +x ${fallbackFfmpegPath} ${fallbackFfprobePath}`);
                console.log(`Created copies of FFmpeg and FFprobe in ${fallbackBinDir} for compatibility`);
              }
            } catch (primaryCopyError) {
              console.error(`Failed to copy FFmpeg to ${primaryBinDir}:`, primaryCopyError.message);
            }
          }
          
          // Try fallback directory if primary failed or wasn't created
          if (!ffmpegInstalled && fallbackDirCreated) {
            try {
              await execAsync(`cp /tmp/ffmpeg/ffmpeg ${fallbackFfmpegPath}`);
              await execAsync(`cp /tmp/ffmpeg/ffprobe ${fallbackFfprobePath}`);
              await execAsync(`chmod +x ${fallbackFfmpegPath} ${fallbackFfprobePath}`);
              console.log(`FFmpeg and FFprobe copied to ${fallbackBinDir}`);
              ffmpegInstalled = true;
            } catch (fallbackCopyError) {
              console.error(`Failed to copy FFmpeg to ${fallbackBinDir}:`, fallbackCopyError.message);
            }
          }
          
          // Clean up temporary files
          await execAsync('rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg');
          
          // Verify FFmpeg works
          if (ffmpegInstalled) {
            try {
              // Try to verify from primary directory first
              if (fs.existsSync(primaryFfmpegPath)) {
                const { stdout } = await execAsync(`${primaryFfmpegPath} -version`);
                console.log('FFmpeg version info:', stdout.split('\n')[0]);
              } else if (fs.existsSync(fallbackFfmpegPath)) {
                const { stdout } = await execAsync(`${fallbackFfmpegPath} -version`);
                console.log('FFmpeg version info:', stdout.split('\n')[0]);
              }
            } catch (verifyError) {
              console.warn('FFmpeg verification failed:', verifyError.message);
            }
          }
        } catch (ffmpegError) {
          console.error('Failed to download or extract FFmpeg:', ffmpegError.message);
        
        if (!ffmpegInstalled) {
          console.warn('FFmpeg installation failed, but will continue execution');
          // Don't throw an error, let the application continue and handle errors during download
        }
      }
        
        if (!ffmpegInstalled) {
          console.warn('FFmpeg installation failed, but will continue execution');
          // Don't throw an error, let the application continue and handle errors during download
        }
      }
      
      // Create a flag file to indicate setup is complete
      try {
        // Try to create flag in primary directory first
        if (primaryDirCreated) {
          try {
            await execAsync(`sudo bash -c 'echo "Setup completed successfully" > ${primaryBinDir}/setup_complete'`);
            console.log(`Created setup_complete flag in ${primaryBinDir}`);
          } catch (primaryFlagError) {
            console.error(`Failed to create setup_complete flag in ${primaryBinDir}:`, primaryFlagError.message);
            
            // Try fallback directory
            if (fallbackDirCreated) {
              try {
                fs.writeFileSync(`${fallbackBinDir}/setup_complete`, 'Setup completed successfully');
                console.log(`Created setup_complete flag in ${fallbackBinDir}`);
              } catch (fallbackFlagError) {
                console.error(`Failed to create setup_complete flag in ${fallbackBinDir}:`, fallbackFlagError.message);
                
                // Try /tmp as last resort
                try {
                  fs.writeFileSync('/tmp/setup_complete', 'Setup completed successfully');
                  console.log('Created setup_complete flag in /tmp');
                } catch (tmpFlagError) {
                  console.error('Failed to create setup_complete flag in /tmp:', tmpFlagError.message);
                }
              }
            } else {
              // Try /tmp directly if fallback directory wasn't created
              try {
                fs.writeFileSync('/tmp/setup_complete', 'Setup completed successfully');
                console.log('Created setup_complete flag in /tmp');
              } catch (tmpFlagError) {
                console.error('Failed to create setup_complete flag in /tmp:', tmpFlagError.message);
              }
            }
          }
        } else if (fallbackDirCreated) {
          // Try fallback directory if primary wasn't created
          try {
            fs.writeFileSync(`${fallbackBinDir}/setup_complete`, 'Setup completed successfully');
            console.log(`Created setup_complete flag in ${fallbackBinDir}`);
          } catch (fallbackFlagError) {
            console.error(`Failed to create setup_complete flag in ${fallbackBinDir}:`, fallbackFlagError.message);
            
            // Try /tmp as last resort
            try {
              fs.writeFileSync('/tmp/setup_complete', 'Setup completed successfully');
              console.log('Created setup_complete flag in /tmp');
            } catch (tmpFlagError) {
              console.error('Failed to create setup_complete flag in /tmp:', tmpFlagError.message);
            }
          }
        } else {
          // Try /tmp directly if neither directory was created
          try {
            fs.writeFileSync('/tmp/setup_complete', 'Setup completed successfully');
            console.log('Created setup_complete flag in /tmp');
          } catch (tmpFlagError) {
            console.error('Failed to create setup_complete flag in /tmp:', tmpFlagError.message);
          }
        }
      } catch (error) {
        console.error('Error creating setup_complete flag:', error.message);
      }
      
      // Update PATH to include both directories
      process.env.PATH = `${primaryBinDir}:${fallbackBinDir}:${process.env.PATH}`;
      console.log(`Updated PATH to include ${primaryBinDir} and ${fallbackBinDir}`);
      
      // Set FFmpeg paths for child processes, prioritizing primary directory
      if (fs.existsSync(primaryFfmpegPath)) {
        process.env.FFMPEG_PATH = primaryFfmpegPath;
        process.env.FFPROBE_PATH = primaryFfprobePath;
        console.log(`Set FFMPEG_PATH to ${primaryFfmpegPath} and FFPROBE_PATH to ${primaryFfprobePath}`);
      } else if (fs.existsSync(fallbackFfmpegPath)) {
        process.env.FFMPEG_PATH = fallbackFfmpegPath;
        process.env.FFPROBE_PATH = fallbackFfprobePath;
        console.log(`Set FFMPEG_PATH to ${fallbackFfmpegPath} and FFPROBE_PATH to ${fallbackFfprobePath}`);
      }
    } catch (error) {
      console.error('Error setting up yt-dlp or FFmpeg:', error);
      console.log('Application will continue, but video downloads may fail');
      // Don't throw error here, let the application continue and handle errors during download
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