const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const YTDLP_PATH = "C:/Tools/yt-dlp/yt-dlp.exe"; // Change this if needed for local dev
const IS_RENDER = process.env.RENDER === "true";
const EXEC_PATH = IS_RENDER ? "yt-dlp" : YTDLP_PATH; // Use yt-dlp in Render, full path locally

const PROXY = "http://us.proxiware.com:8080"; // ✅ You can rotate this
const FALLBACK_DOMAINS = {
  "xhamster.com": [
    "xhamster19.com",
    "xhmaster.desi",
    "xhmaster1.desi",
    "xhaccess.com",
    "xhmaster2.com",
  ],
};

function runYtDlp(url) {
  return new Promise((resolve, reject) => {
    execFile(
      EXEC_PATH,
      [
        url,
        "--dump-json",
        "--no-warnings",
        "--no-playlist",
        "--proxy", PROXY, // ✅ added proxy here
      ],
      { maxBuffer: 1024 * 500 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp error:", error);
          return reject(error);
        }
        try {
          const json = JSON.parse(stdout);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

async function fetchVideoInfoWithFallback(originalUrl) {
  const domain = new URL(originalUrl).hostname;
  const fallbackUrls = (FALLBACK_DOMAINS[domain] || []).map(fallbackDomain =>
    originalUrl.replace(domain, fallbackDomain)
  );

  const urlsToTry = [originalUrl, ...fallbackUrls];
  for (const url of urlsToTry) {
    try {
      console.log("Trying:", url);
      const info = await runYtDlp(url);
      console.log("Success:", url);
      return info;
    } catch (err) {
      console.log("Failed:", url);
    }
  }
  throw new Error("Failed to fetch video info from all sources.");
}

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const info = await fetchVideoInfoWithFallback(url);

    const response = {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      formats: (info.formats || [])
        .filter(f => f.filesize && f.format_note && f.url)
        .map(f => ({
          quality: f.format_note,
          size: (f.filesize / 1048576).toFixed(2) + " MB",
          url: f.url,
        })),
    };

    res.json(response);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to fetch video info from all sources." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
