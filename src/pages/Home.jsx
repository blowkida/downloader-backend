import React, { useState } from 'react';
import DonatePopup from '../components/DonatePopup';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [downloadingFormatId, setDownloadingFormatId] = useState(null);

  const handleDownload = async () => {
    // Basic URL validation
    if (!url) {
      setError('Please enter a URL.');
      return;
    }

    // Basic YouTube URL validation
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeUrlPattern.test(url)) {
      setError('Please enter a valid YouTube URL.');
      return;
    }

    setError(null);
    setLoading(true);
    setProgress(0);
    setVideoInfo(null);

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? prev : prev + 1));
    }, 100);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log('Making request to:', `${API_URL}/api/download`);
      console.log('With URL:', url);
      
      const response = await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url }),
        mode: 'cors',
        credentials: 'include'
        
      });

      const data = await response.json();
      clearInterval(interval);
      setProgress(100);
      setLoading(false);

      if (response.ok && data.title && data.qualityOptions) {
        // Process the qualityOptions to separate video and audio formats
        const video = [];
        const audio = [];
        
        // Filter and process formats to ensure only one option per resolution
        data.qualityOptions.forEach(format => {
          // Only include formats with a known filesize
          if (format.readableFilesize || format.filesize) {
            const formatWithSize = {
              ...format,
              size: format.readableFilesize || (format.filesize ? `${(format.filesize / (1024 * 1024)).toFixed(1)} MB` : format.formatType === "Video" ? '10.00 MB' : '5.00 MB')
            };
            
            if (format.formatType === "Video") {
              // Include all video formats (both with audio and video-only that will have audio added)
              video.push(formatWithSize);
            } else if (format.formatType === "Audio Only") {
              audio.push(formatWithSize);
            }
          }
        });
        
        // Remove duplicates based on resolution for video
        const uniqueVideo = [];
        const videoResolutions = new Set();
        
        video.forEach(format => {
          const resolution = format.height ? `${format.height}p` : format.quality;
          if (!videoResolutions.has(resolution)) {
            videoResolutions.add(resolution);
            uniqueVideo.push(format);
          }
        });
        
        // Sort by resolution (highest first)
        uniqueVideo.sort((a, b) => (b.height || 0) - (a.height || 0));
        
        // Process subtitle options
        const subtitles = data.subtitleOptions?.map(subtitle => ({
          ...subtitle,
          quality: subtitle.languageName || subtitle.language,
          formatInfo: subtitle.formatLabel || subtitle.ext?.toUpperCase() || 'VTT',
          size: 'Small'
        })) || [];
        
        setVideoInfo({
          ...data,
          video: uniqueVideo,
          audio,
          subtitles
        });
      } else {
        setError(data.error || 'Failed to fetch video info');
      }
    } catch (error) {
      clearInterval(interval);
      setProgress(0);
      setLoading(false);
      console.error('Error during download:', error);
      setError('Server error occurred. Please try again later.');
    }
  };

  const handleRealDownload = (url, title) => {
    try {
      console.log('Starting real download with URL:', url);
      console.log('Download title:', title);
      
      // Create a temporary anchor element for download
      const a = document.createElement('a');
      
      // Ensure the URL is valid
      if (!url) {
        throw new Error('No download URL provided');
      }
      
      // Ensure the URL includes the title parameter for proper filename
      let downloadUrl = url;
      try {
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has('title') && title) {
          urlObj.searchParams.set('title', title);
        }
        
        // Add filename parameter if not present
        if (!urlObj.searchParams.has('filename')) {
          const safeFilename = title.replace(/[\/:*?"<>|]/g, '_');
          urlObj.searchParams.set('filename', `${safeFilename}.mp4`);
        }
        
        // Add download parameter to force download
        urlObj.searchParams.set('download', '1');
        
        downloadUrl = urlObj.toString();
      } catch (urlError) {
        console.warn('Error parsing URL:', urlError);
        // Continue with original URL if parsing fails
      }
      
      a.href = downloadUrl;
      
      // Ensure the title is properly set for the download
      // This helps ensure the file is downloaded with the correct name
      const safeFilename = title.replace(/[\/:*?"<>|]/g, '_');
      a.download = `${safeFilename}.mp4`;
      
      // Append to body, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log('Download initiated successfully with URL:', downloadUrl);
    } catch (error) {
      console.error('Error in handleRealDownload:', error);
      setError(`Download failed: ${error.message}`);
    }
  };
  
  // Function to handle download for all formats
  const handleFormatDownload = async (format) => {
    if (!url || !format) {
      setError('Missing URL or format information');
      return;
    }
    
    try {
      // Set the downloading format ID to track which row is downloading
      setDownloadingFormatId(format.formatId);
      setProgress(10);
      console.log('Starting download for format:', format);
      
      // Always use the merged download endpoint for all video formats
      // This ensures proper merging with audio for all video formats
      if (format.hasVideo) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        console.log('Using merged download endpoint:', `${API_URL}/api/download/merged`);
        console.log('Format ID:', format.formatId);
        
        const response = await fetch(`${API_URL}/api/download/merged`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            url,
            videoFormatId: format.formatId
          }),
          mode: 'cors',
          credentials: 'include'
        });
        
        setProgress(90);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to download video: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Download response:', data);
        setProgress(100);
        
        if (!data.downloadUrl) {
          throw new Error('No download URL returned from server');
        }
        
        // Initiate the download with the proper URL and title from the server response
        // This ensures we get the correct filename and size
        handleRealDownload(data.downloadUrl, data.title || videoInfo.title);
      } else {
        // For audio formats, use direct download
        console.log('Using direct download for format:', format);
        setProgress(100);
        
        if (!format.url) {
          throw new Error('No direct download URL available for this format');
        }
        
        // Make sure we have a proper title for the download
        const downloadTitle = videoInfo.title || 'video';
        handleRealDownload(format.url, downloadTitle);
      }
    } catch (error) {
      console.error('Download error:', error);
      setError(error.message || 'Failed to download video');
    } finally {
      // Reset the downloading format ID and loading state
      setDownloadingFormatId(null);
      setProgress(0);
    }
  };

  const renderVideoTable = (title, formats, type) => (
    <div className="mt-2">
      <h3 className="text-md font-semibold mb-2 text-gray-700">{title}</h3>
      {formats.length > 0 ? (
        formats.map((format, i) => (
          <div key={`${type}-${i}`} className="grid grid-cols-4 border-t border-gray-200 hover:bg-gray-50">
            <div className="px-3 py-2">{format.ext?.toUpperCase() || 'MP4'}</div>
            <div className="px-3 py-2">{format.quality}</div>
            <div className="px-3 py-2">{format.size}</div>
            <div className="px-3 py-2">
              <button
                onClick={() => handleFormatDownload(format)}
                className="bg-blue-500 text-white text-xs px-4 py-1 rounded hover:bg-blue-600 w-full"
                disabled={downloadingFormatId !== null}
              >
                {downloadingFormatId === format.formatId ? 'DOWNLOADING...' : 'DOWNLOAD NOW'}
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="border-t border-gray-200 py-2 text-center text-gray-500">
          No formats available
        </div>
      )}
    </div>
  );
  
  const renderAudioTable = (title, formats, type) => (
    <div className="mt-2">
      <h3 className="text-md font-semibold mb-2 text-gray-700">{title}</h3>
      {formats.length > 0 ? (
        formats.map((format, i) => (
          <div key={`${type}-${i}`} className="grid grid-cols-4 border-t border-gray-200 hover:bg-gray-50">
            <div className="px-3 py-2">{format.ext?.toUpperCase() || 'MP3'}</div>
            <div className="px-3 py-2">{format.quality}</div>
            <div className="px-3 py-2">{format.size}</div>
            <div className="px-3 py-2">
              <button
                onClick={() => handleFormatDownload(format)}
                className="bg-blue-500 text-white text-xs px-4 py-1 rounded hover:bg-blue-600 w-full"
                disabled={downloadingFormatId !== null}
              >
                {downloadingFormatId === format.formatId ? 'DOWNLOADING...' : 'DOWNLOAD NOW'}
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="border-t border-gray-200 py-2 text-center text-gray-500">
          No formats available
        </div>
      )}
    </div>
  );
  
  const renderSubtitleTable = (title, formats, type) => (
    <div className="mt-2">
      <h3 className="text-md font-semibold mb-2 text-gray-700">{title}</h3>
      {formats.length > 0 ? (
        formats.map((format, i) => {
          // Create a unique ID for subtitle formats since they don't have formatId
          const subtitleId = `subtitle-${format.language}-${i}`;
          return (
            <div key={`${type}-${i}`} className="grid grid-cols-4 border-t border-gray-200 hover:bg-gray-50">
              <div className="px-3 py-2">{format.ext?.toUpperCase() || 'VTT'}</div>
              <div className="px-3 py-2">{format.quality}</div>
              <div className="px-3 py-2">Small</div>
              <div className="px-3 py-2">
                <button
                  onClick={() => {
                    setDownloadingFormatId(subtitleId);
                    handleRealDownload(format.url, `${videoInfo.title}_${format.language}`);
                    setTimeout(() => setDownloadingFormatId(null), 1000); // Reset after download starts
                  }}
                  className="bg-blue-500 text-white text-xs px-4 py-1 rounded hover:bg-blue-600 w-full"
                  disabled={downloadingFormatId !== null}
                >
                  {downloadingFormatId === subtitleId ? 'DOWNLOADING...' : 'DOWNLOAD NOW'}
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="border-t border-gray-200 py-2 text-center text-gray-500">
          No subtitles available
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col justify-between">
      {showDonate && <DonatePopup onClose={() => setShowDonate(false)} />}

      <header className="bg-orange-400 backdrop-blur-md fixed top-0 left-0 w-full z-50 px-6 py-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src="/ss-youtube-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-xl font-bold text-orange-600">SS YouTube</span>
          <span className="text-xs text-gray-500">V1.0</span>
        </div>
        <nav className="space-x-6 text-sm font-medium text-white">
          <a href="#">ADDED SITES</a>
          <button onClick={() => setShowDonate(true)}>DONATE</button>
          <a href="#">SUPPORT</a>
          <a href="#">SETTINGS</a>
        </nav>
      </header>

      <main className="pt-28 flex flex-col items-center justify-center flex-1 px-4 py-10 bg-orange-500">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">YouTube Video Downloader</h1>
        <p className="text-sm text-gray-900 mb-2">Paste any video URL to download</p>

        <div className="w-full max-w-2xl flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any video URL to download"
            className="flex-grow px-4 py-3 border border-red-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-red-600"
          >
            DOWNLOAD
          </button>
        </div>
        <p className="text-xl text-gray-100 mb-2">It's 100% Safe & Free to Use.</p>

        {loading && (
          <div className="mt-6 w-full max-w-md">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-gray-600 mt-1">Fetching... {progress}%</p>
          </div>
        )}

        {error && (
          <div className="mt-6 w-full max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {videoInfo && (
          <div className="mt-8 w-full max-w-3xl bg-white p-4 shadow rounded-md">
            <div className="flex gap-4 mb-4">
              <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-40 h-24 object-cover rounded" />
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{videoInfo.title}</h2>
                <p className="text-sm text-gray-500">{videoInfo.duration}</p>
                <p className="text-xs text-gray-400 mt-1 italic">Source: {new URL(url).hostname}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 bg-orange-100 p-2 text-sm font-medium">
                <div className="px-3 py-2">FORMAT</div>
                <div className="px-3 py-2">QUALITY</div>
                <div className="px-3 py-2">FILE SIZE</div>
                <div className="px-3 py-2">DOWNLOAD LINK</div>
              </div>
              
              {videoInfo.video?.length > 0 && renderVideoTable("VIDEO", videoInfo.video, "video")}
              {videoInfo.audio?.length > 0 && renderAudioTable("AUDIO", videoInfo.audio, "audio")}
              {videoInfo.subtitles?.length > 0 && renderSubtitleTable("SUBTITLES", videoInfo.subtitles, "subs")}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-6 text-center text-sm text-orange-600 flex flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-6">
          <a href="#">Add to home screen?</a>
          <a href="#">Browser Bookmarklet?</a>
          <a href="#">Request a website?</a>
          <a href="#">Learn how to use?</a>
        </div>
        <p className="text-xs text-gray-400 mt-2">&copy; 2025 SS-YouTube. All rights reserved.</p>
        <p className="text-xs text-gray-400 mt-2">Designed and Developed By Manish Singh</p>
      </footer>
    </div>
  );
}
