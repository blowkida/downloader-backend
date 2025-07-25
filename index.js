import express from "express";
import cors from "cors";
import { execYtDlp, puppeteerFallback } from "./ytDlpHelper.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post("/api/fetch", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // 1️⃣ Try yt-dlp first
    const result = await execYtDlp(url);
    const json = JSON.parse(result);

    const formats = json.formats?.map(f => ({
      quality: f.format_note || f.height || "unknown",
      size: f.filesize || f.filesize_approx || 0,
      url: f.url,
      ext: f.ext,
    })).filter(f => f.url);

    return res.json({
      title: json.title,
      thumbnail: json.thumbnail,
      duration: json.duration,
      formats,
    });

  } catch (ytErr) {
    console.warn("yt-dlp failed, trying Puppeteer fallback...");

    try {
      // 2️⃣ Try Puppeteer fallback
      const fallbackResult = await puppeteerFallback(url);
      return res.json(fallbackResult);

    } catch (puppeteerErr) {
      console.error("Both methods failed:", puppeteerErr.message);
      return res.status(500).json({ error: "Failed to fetch video info" });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
