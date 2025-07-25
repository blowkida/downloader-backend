import express from "express";
import cors from "cors";
import { execYtDlp } from "./ytDlpHelper.js";
import fallbackDomains from "./fallbackDomains.js";

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
      finalError = err;
    }
    return null;
  };

  let info = await tryFetch(url);
  if (info) return info;

  for (const fallback of fallbackDomains) {
    if (url.includes(fallback.original)) {
      for (const domain of fallback.alternatives) {
        const newUrl = url.replace(fallback.original, domain);
        info = await tryFetch(newUrl);
        if (info) return info;
      }
    }
  }

  throw new Error("Failed to fetch video info from all sources.");
};

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided." });

  console.log("Trying:", url);

  try {
    const info = await fetchVideoInfoWithFallback(url);
    const video = {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
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
    console.error("Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
