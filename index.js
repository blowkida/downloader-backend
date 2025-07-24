import express from "express";
import cors from "cors";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import util from "util";

const app = express();
const port = process.env.PORT || 10000;
const execFilePromise = util.promisify(execFile);
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Linux-compatible yt-dlp path (assumes it's in PATH or placed correctly)
const ytdlpPath = "yt-dlp"; // You can also use full path like "/usr/bin/yt-dlp"

const fallbackDomains = {
  "xhamster.com": [
    "xhamster.desi", "xhmaster1.desi", "xhaccess.com",
    "xhamster19.com", "xhmaster2.com"
  ],
};

function replaceDomain(url, newDomain) {
  try {
    const u = new URL(url);
    u.hostname = newDomain;
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchVideoInfoWithFallback(originalUrl) {
  const domain = Object.keys(fallbackDomains).find(d => originalUrl.includes(d));
  const fallbackUrls = domain ? [originalUrl, ...fallbackDomains[domain].map(dom => replaceDomain(originalUrl, dom))] : [originalUrl];

  for (const url of fallbackUrls) {
    console.log(`Trying: ${url}`);
    try {
      const { stdout } = await execFilePromise(ytdlpPath, [
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        "-f", "best",
        url
      ]);

      const data = JSON.parse(stdout);
      const formats = (data.formats || []).filter(f => f.url && f.format_note).map(f => ({
        quality: f.format_note || f.format || "unknown",
        size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(2) + " MB" : "N/A",
        url: f.url,
      }));

      return {
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        formats,
      };
    } catch (err) {
      console.error(`Failed: ${url}\n`, err.message);
      continue;
    }
  }

  throw new Error("Failed to fetch video info from all sources.");
}

app.post("/api/download", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const videoInfo = await fetchVideoInfoWithFallback(url);
    res.json(videoInfo);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
