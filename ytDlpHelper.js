import { exec } from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const fallbackMap = [
  {
    original: "xhamster.com",
    alternatives: [
      "xhaccess.com",
      "xhmaster.desi",
      "xhmaster1.desi",
      "xhmaster2.com",
      "xhmaster19.com"
    ]
  },
  {
    original: "pornhub.com",
    alternatives: [
      "pornhub.org",
      "pornhubpremium.com"
    ]
  }
];

const cookiePathMap = {
  "xhamster.com": "./cookies/xhamster.com_cookies.txt",
  "pornhub.com": "./cookies/pornhub.com_cookies.txt"
};

function getCookieFile(url) {
  try {
    const domain = Object.keys(cookiePathMap).find(d => url.includes(d));
    const cookiePath = domain ? cookiePathMap[domain] : null;
    if (cookiePath && fs.existsSync(cookiePath)) {
      return cookiePath;
    }
  } catch (e) {
    console.warn("Cookie file not found or failed to read.");
  }
  return null;
}

async function runYtDlp(url, useCookies = true) {
  const options = {
    dumpSingleJson: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
    referer: url,
    noWarnings: true,
    forceGenericExtractor: false
  };

  const cookieFile = useCookies ? getCookieFile(url) : null;
  if (cookieFile) {
    options.cookies = cookieFile;
  }

  return await exec(url, options);
}

function buildFallbackUrls(originalUrl) {
  for (const entry of fallbackMap) {
    if (originalUrl.includes(entry.original)) {
      return entry.alternatives.map(alt =>
        originalUrl.replace(entry.original, alt)
      );
    }
  }
  return [];
}

async function puppeteerExtractVideoInfo(url) {
  console.log("Trying Puppeteer as last resort...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const pageTitle = await page.title();
    const thumbnail = await page.$eval("meta[property='og:image']", el => el.content).catch(() => null);
    const duration = await page.$eval("meta[property='video:duration']", el => parseInt(el.content)).catch(() => null);
    const videoUrl = await page.$eval("video source", el => el.src).catch(() => null);

    if (!videoUrl) throw new Error("No downloadable video found on page.");

    return {
      title: pageTitle,
      thumbnail,
      duration,
      formats: [
        {
          ext: "mp4",
          format_note: "Puppeteer Extracted",
          filesize: null,
          url: videoUrl
        }
      ]
    };
  } finally {
    await browser.close();
  }
}

export async function execYtDlp(url) {
  const triedUrls = [url, ...buildFallbackUrls(url)];

  for (const attemptUrl of triedUrls) {
    try {
      console.log("Trying yt-dlp for:", attemptUrl);
      const result = await runYtDlp(attemptUrl);
      if (result && result.formats?.length) {
        return result;
      }
    } catch (err) {
      console.warn("yt-dlp failed for:", attemptUrl);
    }
  }

  // If all yt-dlp attempts fail, try Puppeteer
  try {
    const puppeteerResult = await puppeteerExtractVideoInfo(url);
    if (puppeteerResult) return puppeteerResult;
  } catch (err) {
    console.warn("Puppeteer fallback failed:", err.message);
  }

  throw new Error("All attempts to extract video info failed.");
}
