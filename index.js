// server/index.js

import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to yt-dlp (assumes it's in PATH on Render)
const ytdlpPath = 'yt-dlp';

// Domains to try for fallback (for sites like xhamster)
const fallbackDomains = {
  'xhamster.com': [
    'xhamster19.com',
    'xhmaster.desi',
    'xhmaster1.desi',
    'xhaccess.com',
    'xhmaster2.com'
  ],
  'xhamster19.com': [
    'xhamster.com',
    'xhmaster.desi',
    'xhmaster1.desi',
    'xhaccess.com',
    'xhmaster2.com'
  ]
};

// Utility to run yt-dlp with a given URL
function runYtDlp(url, proxy = null) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--restrict-filenames',
      '--no-call-home',
      url
    ];

    if (proxy) {
      args.unshift(`--proxy=${proxy}`);
    }

    execFile(ytdlpPath, args, (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        reject('Failed to parse yt-dlp JSON output');
      }
    });
  });
}

// Try all fallbacks one by one
async function fetchVideoInfoWithFallback(url) {
  const domain = new URL(url).hostname.replace('www.', '');
  const fallbacks = fallbackDomains[domain] || [];

  const urlsToTry = [url, ...fallbacks.map(d => url.replace(domain, d))];

  for (let u of urlsToTry) {
    try {
      console.log('Trying:', u);
      const info = await runYtDlp(u);
      return info;
    } catch (e) {
      console.log('Failed:', u);
    }
  }

  throw new Error('Failed to fetch video info from all sources.');
}

// API endpoint
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    const info = await fetchVideoInfoWithFallback(url);

    const formats = (info.formats || [])
      .filter(f => f.filesize && f.format_note && f.url)
      .map(f => ({
        quality: f.format_note || f.format || f.resolution || 'unknown',
        size: `${(f.filesize / (1024 * 1024)).toFixed(2)} MB`,
        url: f.url
      }));

    return res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      formats
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch video info from all sources.' });
  }
});

// Bind to port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
