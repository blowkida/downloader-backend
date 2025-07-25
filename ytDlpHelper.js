import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ytdlp from "yt-dlp-exec";
import puppeteer from "puppeteer";

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to YouTube cookies
const youtubeCookiesPath = path.join(__dirname, "youtube-cookies");

// Helper to detect YouTube URLs
function isYouTubeURL(url) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

// Main fetch function
export async function fetchVideoInfo(url) {
  try {
    console.log(`Trying: ${url}`);

    const ytdlpArgs = {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      referer: url,
    };

    // If YouTube, pass cookies
    if (isYouTubeURL(url) && fs.existsSync(youtubeCookiesPath)) {
      console.log("Using YouTube cookies...");
      ytdlpArgs.cookies = youtubeCookiesPath;
    }

    const info = await ytdlp(url, ytdlpArgs);
    if (!info.formats || info.formats.length === 0) {
      throw new Error("No formats found");
    }

    return parseVideoInfo(info);
  } catch (err) {
    console.error("yt-dlp failed on original URL:", err.message);

    // Puppeteer Fallback (Universal)
    try {
      const puppeteerInfo = await extractWithPuppeteer(url);
      if (puppeteerInfo) {
        return puppeteerInfo;
      } else {
        throw new Error("Puppeteer returned no usable data");
      }
    } catch (fallbackErr) {
      console.error("❌ Final Error:", fallbackErr.message);
      return null;
    }
  }
}

// Puppeteer fallback handler
async function extractWithPuppeteer(url) {
  console.log("Trying Puppeteer fallback...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const title = await page.title();
    const thumbnail = await page.$eval("meta[property='og:image']", el => el.content).catch(() => null);
    const duration = await page.$eval("meta[itemprop='duration']", el => el.content).catch(() => null);

    return {
      title: title || "Unknown Title",
      thumbnail: thumbnail || "",
      duration: duration || "Unknown",
      formats: [],
    };
  } catch (err) {
    console.error("Puppeteer fallback failed:", err.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Parser for yt-dlp JSON
function parseVideoInfo(info) {
  return {
    title: info.title,
    thumbnail: info.thumbnail,
    duration: info.duration,
    formats: (info.formats || [])
      .filter(f => f.url)
      .map(f => ({
        quality:
          f.format_note ||
          f.resolution ||
          f.format_id ||
          "Unknown",
        size: formatBytes(f.filesize || f.filesize_approx),
        url: f.url,
      })),
  };
}


function formatBytes(bytes) {
  if (!bytes) return "Unknown";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}
