import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const execPromise = util.promisify(exec);

const fallbackDomains = {
  "xhamster.com": [
    "xhmaster.desi",
    "xhmaster1.desi",
    "xhaccess.com",
    "xhmaster19.com",
    "xhmaster2.com"
  ]
};

const cookiesPath = path.resolve("cookies.txt");

async function execYtDlp(url) {
  const command = [
    "yt-dlp",
    "--no-playlist",
    "--dump-json",
    `--cookies ${cookiesPath}`,
    `"${url}"`
  ].join(" ");

  try {
    const { stdout } = await execPromise(command);
    const data = JSON.parse(stdout);

    const formats = (data.formats || [])
      .filter(f => f.filesize && f.format_id && f.url)
      .map(f => ({
        quality: f.format_note || f.format || "unknown",
        size: (f.filesize / (1024 * 1024)).toFixed(2) + " MB",
        url: f.url
      }));

    return {
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      formats
    };
  } catch (err) {
    console.warn("yt-dlp failed on:", url);
    return null; // Trigger fallback
  }
}

async function fetchVideoInfo(originalUrl) {
  const urlObj = new URL(originalUrl);
  const baseDomain = urlObj.hostname.replace("www.", "");

  // Try original URL first
  const directResult = await execYtDlp(originalUrl);
  if (directResult) return directResult;

  // Try fallback domains
  if (fallbackDomains[baseDomain]) {
    for (const domain of fallbackDomains[baseDomain]) {
      const fallbackUrl = originalUrl.replace(baseDomain, domain);
      const fallbackResult = await execYtDlp(fallbackUrl);
      if (fallbackResult) return fallbackResult;
    }
  }

  // Try puppeteer last
  return await fallbackWithPuppeteer(originalUrl);
}

async function fallbackWithPuppeteer(url) {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
      const cookieTxt = fs.readFileSync(cookiesPath, "utf-8");
      const cookies = cookieTxt
        .split("\n")
        .filter(line => !line.startsWith("#") && line.trim())
        .map(line => {
          const parts = line.split("\t");
          return {
            domain: parts[0],
            name: parts[5],
            value: parts[6],
            path: parts[2],
            httpOnly: false,
            secure: false
          };
        });
      await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const title = await page.title();
    const thumbnail = await page.$eval("meta[property='og:image']", el => el.content).catch(() => null);
    const duration = await page.$eval("meta[property='og:video:duration']", el => el.content).catch(() => null);

    await browser.close();

    return {
      title,
      thumbnail,
      duration,
      formats: []
    };
  } catch (error) {
    console.error("Puppeteer fallback failed:", error);
    return null;
  }
}

export default fetchVideoInfo;
