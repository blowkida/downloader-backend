import express from "express";
import cors from "cors";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";

dotenv.config();
const execFilePromise = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 5000;

// yt-dlp executable path (Linux compatible)
const YT_DLP_PATH = "yt-dlp"; // assumes it's in $PATH

// Optional proxy from .env (e.g., http://ip:port)
const PROXY = process.env.PROXY_URL;

app.use(cors());
app.use(express.json());

async function fetchVideoInfo(url) {
  const args = ["--dump-json"];
  if (PROXY) {
    args.push("--proxy", PROXY);
  }
  args.push(url);

  try {
    const { stdout } = await execFilePromise(YT_DLP_PATH, args);
    return JSON.parse(stdout);
  } catch (err) {
    console.error("yt-dlp error:", err.stderr || err.message);
    return null;
  }
}

async function fetchVideoInfoWithFallback(url) {
  const fallbackDomains = [];

  // Handle XHamster domain fallback
  if (url.includes("xhamster")) {
    fallbackDomains.push(
      "xhmaster.desi",
      "xhmaster1.desi",
      "xhaccess.com",
      "xhmaster19.com",
      "xhmaster2.com"
    );
  }

  // Try original URL first
  const originalInfo = await fetchVideoInfo(url);
  if (originalInfo) return originalInfo;

  // Try fallback domains
  for (const domain of fallbackDomains) {
    const fallbackUrl = url.replace(/xhamster\d*\.com/, domain);
    console.log("Trying:", fallbackUrl);
    const info = await fetchVideoInfo(fallbackUrl);
    if (info) return info;
    console.log("Failed:", fallbackUrl);
  }

  throw new Error("Failed to fetch video info from all sources.");
}

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const info = await fetchVideoInfoWithFallback(url);
    const { title, thumbnail, duration, formats } = info;

    const downloadOptions = formats
      .filter(f => f.url && f.format_note && f.filesize)
      .map(f => ({
        quality: f.format_note,
        size: (f.filesize / (1024 * 1024)).toFixed(2) + " MB",
        url: f.url,
      }));

    return res.json({
      title,
      thumbnail,
      duration,
      downloadOptions,
    });
  } catch (err) {
    console.error("Download error:", err.message);
    return res.status(500).json({ error: "Failed to fetch video info from all sources." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
