import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import ytDlpExec from "yt-dlp-exec";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

// Universal fallback by replacing domain
async function tryFallbackDomains(originalUrl) {
  const fallbackDomains = [
    "xhamster.desi",
    "xhmaster.desi",
    "xhmaster1.desi",
    "xhaccess.com",
    "xhmaster19.com",
    "xhmaster2.com",
  ];

  const fallbackUrls = fallbackDomains
    .map(domain => {
      try {
        const url = new URL(originalUrl);
        url.hostname = domain;
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return fallbackUrls;
}

// Optional: Puppeteer fallback (disabled on production like Render)
async function tryPuppeteerFallback(url) {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    const title = await page.title();
    const thumbnail = await page.screenshot({ type: "jpeg" });

    await browser.close();

    return {
      title,
      thumbnail: `data:image/jpeg;base64,${thumbnail.toString("base64")}`,
      formats: [],
    };
  } catch (error) {
    console.error("Puppeteer Fallback Error:", error.message);
    return null;
  }
}

export async function fetchVideoInfo(originalUrl, usePuppeteerFallback = true) {
  let urlsToTry = [originalUrl];
  const isYouTube = originalUrl.includes("youtube.com") || originalUrl.includes("youtu.be");

  // Add fallback domains if not YouTube
  if (!isYouTube) {
    const fallbacks = await tryFallbackDomains(originalUrl);
    urlsToTry.push(...fallbacks);
  }

  let info = null;
  let lastError = null;

  for (const url of urlsToTry) {
    try {
      const args = [
        url,
        "--dump-single-json",
        "--no-check-certificates",
        "--no-warnings",
        "--prefer-free-formats",
        "--youtube-skip-dash-manifest",
        "--referer", url,
      ];

      if (isYouTube) {
        args.push("--cookies", path.join(__dirname, "youtube-cookies"));
      }

      info = await ytDlpExec(args, {
        env: { ...process.env },
      });

      if (info) break;
    } catch (error) {
      lastError = error;
      console.warn(`yt-dlp failed on ${url}:`, error.message);
    }
  }

  // Final fallback: Puppeteer (only if not on production)
  if (!info && usePuppeteerFallback && process.env.NODE_ENV !== "production") {
    console.log("Trying Puppeteer fallback...");
    info = await tryPuppeteerFallback(originalUrl);
  }

  if (!info) {
    throw new Error("Unable to fetch video info: " + (lastError?.message || "Unknown error"));
  }

  const formats = (info.formats || [])
    .filter(f => f.filesize && f.format_id && f.ext)
    .map(f => ({
      formatId: f.format_id,
      type: f.ext,
      quality: f.format_note || f.resolution || f.quality || "unknown",
      size: f.filesize,
      url: f.url,
    }));

  return {
    title: info.title || "Untitled",
    thumbnail: info.thumbnail || "",
    duration: info.duration || 0,
    formats,
  };
}
