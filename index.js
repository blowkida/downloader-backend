import express from "express";
import cors from "cors";
import { execYtDlp } from "./ytDlpHelper.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided." });

  console.log("Trying:", url);

  try {
    const info = await execYtDlp(url);
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
