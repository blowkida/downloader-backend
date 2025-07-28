import React, { useState } from 'react';
import DonatePopup from '../components/DonatePopup';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleDownload = async () => {
    if (!url) return alert('Please enter a valid URL.');

    setError(null);
    setLoading(true);
    setProgress(0);
    setVideoInfo(null);

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? prev : prev + 1));
    }, 100);

    try {
      const response = await fetch('https://downloader-backend-98nj.onrender.com/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      clearInterval(interval);
      setProgress(100);
      setLoading(false);

      if (response.ok && data.title && data.formats) {
        setVideoInfo({
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration + ' seconds',
          formats: data.formats,
        });
      } else {
        setError(data.error || 'Failed to fetch video info');
      }
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setLoading(false);
      setError('Server error occurred.');
    }
  };

  const handleRealDownload = (url, title) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col justify-between">
      {showDonate && <DonatePopup onClose={() => setShowDonate(false)} />}

      {/* HEADER */}
      <header className="bg-orange-400 fixed top-0 left-0 w-full z-50 px-6 py-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src="/ss-youtube-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-lg font-bold text-orange-600">SS YouTube</span>
          <span className="text-xs text-gray-100 hidden sm:inline">V1.0</span>
        </div>

        <nav className="hidden sm:flex space-x-6 text-sm font-medium text-white">
          <a href="#">ADDED SITES</a>
          <button onClick={() => setShowDonate(true)}>DONATE</button>
          <a href="#">SUPPORT</a>
          <a href="#">SETTINGS</a>
        </nav>

        {/* Mobile */}
        <div className="sm:hidden">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="absolute top-full right-6 mt-2 w-48 bg-white rounded-md shadow-lg p-3 flex flex-col space-y-2 text-sm font-medium text-gray-700 sm:hidden z-50">
            <a href="#">ADDED SITES</a>
            <button onClick={() => setShowDonate(true)}>DONATE</button>
            <a href="#">SUPPORT</a>
            <a href="#">SETTINGS</a>
          </div>
        )}
      </header>

      {/* MAIN */}
      <main className="pt-28 flex flex-col items-center justify-center flex-1 px-4 py-10 bg-orange-500">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">YouTube Video Downloader</h1>
        <p className="text-sm text-orange-100 mb-4 text-center">Paste any video URL to download</p>

        <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste video URL"
            className="flex-grow px-4 py-3 border border-red-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-red-600"
          >
            DOWNLOAD
          </button>
        </div>

        <p className="text-sm text-white mt-2">100% Safe & Free to Use</p>

        {loading && (
          <div className="mt-6 w-full max-w-md">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-center text-sm text-gray-100 mt-1">Fetching... {progress}%</p>
          </div>
        )}

        {error && <p className="text-red-500 mt-4">{error}</p>}

        {videoInfo && (
          <div className="mt-8 w-full max-w-3xl bg-white p-4 shadow rounded-md">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-full sm:w-40 h-auto rounded" />
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{videoInfo.title}</h2>
                <p className="text-sm text-gray-500">{videoInfo.duration}</p>
                <p className="text-xs text-gray-400 mt-1 italic">Source: {new URL(url).hostname}</p>
              </div>
            </div>
            <table className="w-full text-sm text-left border-t">
              <thead>
                <tr className="bg-orange-100">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Quality</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {videoInfo.formats.map((format, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{format.type}</td>
                    <td className="px-3 py-2">{format.quality}</td>
                    <td className="px-3 py-2">{format.size}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleRealDownload(format.url, videoInfo.title)}
                        className="bg-orange-500 text-white text-xs px-3 py-1 rounded hover:bg-orange-600"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t py-6 text-center text-sm text-orange-600 flex flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-6">
          <a href="#">Add to home screen?</a>
          <a href="#">Browser Bookmarklet?</a>
          <a href="#">Request a website?</a>
          <a href="#">Learn how to use?</a>
        </div>
        <p className="text-xs text-gray-400 mt-2">&copy; 2025 SS-YouTube. All rights reserved.</p>
        <p className="text-xs text-gray-400">Designed and Developed By Manish Singh</p>
      </footer>
    </div>
  );
}
