import express from 'express';
import cors from 'cors';
import { fetchVideoInfo } from './ytDlpHelper.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/video', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const info = await fetchVideoInfo(url);

    // Normalize output
    const output = {
      title: info.title || 'Untitled',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      formats: (info.formats || []).map(f => ({
        format_id: f.format_id,
        quality: f.format_note || f.quality || 'unknown',
        filesize: f.filesize || null,
        ext: f.ext || '',
        url: f.url
      }))
    };

    res.json(output);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video info', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  // 2. Try fallbacks
  const fallbacks = getFallbackUrls(originalUrl);
  for (const fb of fallbacks) {
    info = await runYtDlp(fb, originalUrl);
    if (info) return info;
  }

  // 3. Puppeteer scrape
  info = await puppeteerScrape(originalUrl);
  if (info) return info;

  return null;
}   
