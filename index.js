const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const YT_DLP_PATH = "C:/Tools/yt-dlp/yt-dlp.exe"; // Make sure this path is correct
const FALLBACK_DOMAINS = {
  xhamster: [
    "xhamster.com",
    "xhamster19.com",
    "xhmaster.desi",
    "xhmaster1.desi",
    "xhaccess.com",
    "xhmaster2.com",
  ],
};

function replaceDomain(originalUrl, newDomain) {
  try {
    const url = new URL(originalUrl);
    return originalUrl.replace(url.hostname, newDomain);
  } catch (e) {
    return originalUrl;
  }
}

function runYtDlp(url, proxy = null) {
  return new Promise((resolve, reject) => {
    const args = [
      "--dump-json",
      "--no-warnings",
      "--no-playlist",
      "--no-check-certificate",
      "--no-call-home",
      "--no-cache-dir",
      url,
    ];
    if (proxy) {
      args.push(`--proxy=${proxy}`);
    }

    execFile(YT_DLP_PATH, args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function fetchWithFallbackDomains(url) {
  for (const domainType in FALLBACK_DOMAINS) {
    if (url.includes(domainType)) {
      for (const alt of FALLBACK_DOMAINS[domainType]) {
        const altUrl = replaceDomain(url, alt);
        try {
          const info = await runYtDlp(altUrl);
          return info;
        } catch (err) {
          continue;
        }
      }
    }
  }
  throw new Error("All fallback domains failed.");
}

async function scrapeWithPuppeteer(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const data = await page.evaluate(() => {
      const title = document.querySelector("title")?.innerText || "Unknown";
      const thumbnail =
        document.querySelector("meta[property='og:image']")?.content || "";
      const duration =
        document.querySelector("meta[itemprop='duration']")?.content || "Unknown";
      return {
        title,
        thumbnail,
        duration,
        formats: [],
      };
    });

    await browser.close();
    return data;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

app.post("/api/download", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "Missing URL." });

  try {
    let info;

    try {
      info = await runYtDlp(url, "socks5://127.0.0.1:9050"); // Tor/Proxy supported
    } catch (e1) {
      try {
        info = await fetchWithFallbackDomains(url);
      } catch (e2) {
        info = await scrapeWithPuppeteer(url); // last resort
      }
    }

    const response = {
      title: info.title || "Unknown",
      thumbnail: info.thumbnail || "",
      duration: info.duration || info.length_seconds || "Unknown",
      formats: [],
    };

    if (info.formats?.length) {
      response.formats = info.formats
        .filter((f) => f.url && f.format_note)
        .map((f) => ({
          quality: f.format_note,
          size: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(2)} MB` : "N/A",
          url: f.url,
        }));
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch video info from all sources." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
