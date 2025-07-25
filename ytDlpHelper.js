import ytdlp from "yt-dlp-exec";
import path from "path";
import { fileURLToPath } from "url";
import fallbackDomains from "./fallbackDomains.js";
import puppeteer from "puppeteer";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cookie directory
const cookieDir = path.join(__dirname, "cookies");

// Get cookie file based on domain
function getCookieFile(domain) {
  const knownSites = {
    "youtube.com": "youtube.txt",
    "pornhat.com": "pornhat.txt",
    "xhamster.com": "xhamster.txt",
    "xhamster1.desi": "xhamster.txt",
    "xhaccess.com": "xhamster.txt",
    "xhmaster1.desi": "xhamster.txt",
    "xhmaster2.com": "xhamster.txt",
    "xhmaster19.com": "xhamster.txt",
    "pornhub.com": "pornhub.txt",
    "xvideos.com": "xvideos.txt",
    "redtube.com": "redtube.txt",
    "youporn.com": "youporn.txt",
    "spankbang.com": "spankbang.txt",
    "tiktok.com": "tiktok.txt",
    "twitter.com": "twitter.txt",
    "instagram.com": "instagram.txt",
    "facebook.com": "facebook.txt",
    "vimeo.com": "vimeo.txt",
    "dailymotion.com": "dailymotion.txt",
    "bilibili.com": "bilibili.txt",
    "twitch.tv": "twitch.txt",
    "rumble.com": "rumble.txt",
    "odnoklassniki.ru": "ok.txt",
    "vk.com": "vk.txt",
    "weibo.com": "weibo.txt",
    "reddit.com": "reddit.txt",
    "tumblr.com": "tumblr.txt",
    "soundcloud.com": "soundcloud.txt",
    "bandcamp.com": "bandcamp.txt",
    "mixcloud.com": "mixcloud.txt",
    "spotify.com": "spotify.txt",
    "apple.com": "apple.txt",
    "deezer.com": "deezer.txt",
    "t.me": "telegram.txt",
    "telegram.org": "telegram.txt",
    "discord.com": "discord.txt",
    "archive.org": "archive.txt",
    "google.com": "google.txt",
    "vkontakte.ru": "vk.txt",
    "ok.ru": "ok1.txt",
    "9gag.com": "9gag.txt",
  };

  for (const key in knownSites) {
    if (domain.includes(key)) {
      return path.join(cookieDir, knownSites[key]);
    }
  }

  return null;
}

// Fallback using Puppeteer scraping
async function fallbackWithPuppeteer(url) {
  console.log("Fallback to Puppeteer for:", url);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait and extract title
    const title = await page.title();
    const thumbnail = await page.$eval("meta[property='og:image']", el => el.content);
    const duration = await page.$eval("meta[itemprop='duration']", el => el.content)
      .catch(() => null);

    return {
      title,
      thumbnail,
      duration,
      formats: [], // Can't get formats without yt-dlp
      webpage_url: url,
    };
  } catch (err) {
    console.warn("Puppeteer failed:", err.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Main function
export async function execYtDlp(originalUrl, proxy = null) {
  const urlObj = new URL(originalUrl);
  const domain = urlObj.hostname.replace("www.", "");

  const urlsToTry = [originalUrl];
  const fallback = fallbackDomains[domain];
  if (fallback && fallback.length > 0) {
    for (const alt of fallback) {
      urlsToTry.push(originalUrl.replace(domain, alt));
    }
  }

  for (const urlToTry of urlsToTry) {
    const currentDomain = new URL(urlToTry).hostname.replace("www.", "");
    const cookieFile = getCookieFile(currentDomain);

    try {
      const options = {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
        referer: urlToTry,
        proxy: proxy || undefined,
        ...(cookieFile && { cookies: cookieFile }),
      };

      console.log("Trying yt-dlp on:", urlToTry);
      const info = await ytdlp(urlToTry, options);
      if (info && info.formats && info.formats.length > 0) {
        return info;
      }
    } catch (err) {
      console.warn(`yt-dlp failed on ${urlToTry}:`, err?.stderr || err?.message);
    }
  }

  // All yt-dlp attempts failed, try Puppeteer
  const scraped = await fallbackWithPuppeteer(originalUrl);
  if (scraped) {
    return scraped;
  }

  throw new Error("All fallback attempts (yt-dlp + Puppeteer) failed.");
}
