import express from "express";
import cors from "cors";
import { fetchVideoInfo } from "./ytDlpHelper.js"; // ✅ correct
import fallbackDomains from "./fallbackDomains.js";
import tryWithPuppeteer from "./puppeteerFallback.js"; // ✅ this is the correct file & export
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const fetchVideoInfoWithFallback = async (url) => {
  let finalError = null;

  const tryFetch = async (targetUrl) => {
    try {
      const result = await execYtDlp(targetUrl);
      if (result?.formats?.length) return result;
    } catch (err) {
      console.warn("yt-dlp failed for:", targetUrl);
      finalError = err;
    }
    return null;
  };

  // Try original URL
  let info = await tryFetch(url);
  if (info) return info;

  // Try fallback domains
  for (const fallback of fallbackDomains) {
    if (url.includes(fallback.original)) {
      for (const domain of fallback.alternatives) {
        const newUrl = url.replace(fallback.original, domain);
        info = await tryFetch(newUrl);
        if (info) return info;
      }
    }
  }

  // If yt-dlp fails completely, try Puppeteer
  try {
    const puppeteerInfo = await extractWithPuppeteer(url);
    if (puppeteerInfo?.formats?.length) return puppeteerInfo;
  } catch (puppeteerError) {
    console.error("Puppeteer fallback failed:", puppeteerError.message);
    finalError = puppeteerError;
  }

  throw new Error("❌ Failed to fetch video info from yt-dlp and puppeteer.");
};

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided." });

  console.log("///////////////////////////////////////////////////////////");
  console.log("Trying:", url);

  try {
    const info = await fetchVideoInfo(url);
    const video = {
      title: info.title || "Untitled Video",
      thumbnail: info.thumbnail || null,
      duration: info.duration || "Unknown",
      formats: info.formats
        .filter(f => f.filesize && f.format_note && f.url)
        .map(f => ({
          type: f.ext || "video",
          quality: f.format_note,
          size: (f.filesize / (1024 * 1024)).toFixed(2) + " MB",
          url: f.url
        }))
    };
    res.json({ success: true, video });
  } catch (err) {
    console.error("❌ Final Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
