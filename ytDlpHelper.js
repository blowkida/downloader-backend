import ytdlp from "yt-dlp-exec";
import fallbackDomains from "./fallbackDomains.js";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cookie directory
const cookieDir = path.join(__dirname, "cookies");

// Function to get appropriate cookie file for a domain
function getCookieFile(domain) {
  const knownSites = {
    "youtube.com": "youtube.txt",
    "pornhat.com": "pornhat.txt",
    "xhamster.com": "xhamster.txt",
    "xhamster1.desi": "xhamster.txt",
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
    "9gag.com": "9gag.txt",
    "reddit.com": "reddit.txt",
    "tumblr.com": "tumblr.txt",
    "liveleak.com": "liveleak.txt",
    "archive.org": "archive.txt",
    "soundcloud.com": "soundcloud.txt",
    "bandcamp.com": "bandcamp.txt",
    "mixcloud.com": "mixcloud.txt",
    "spotify.com": "spotify.txt",
    "apple.com": "apple.txt",
    "deezer.com": "deezer.txt",
    "google.com": "google.txt",
    "t.me": "telegram.txt",
    "telegram.org": "telegram.txt",
    "discord.com": "discord.txt",
    "vkontakte.ru": "vk.txt",
    "ok.ru": "ok1.txt",

  };

  for (const key in knownSites) {
    if (domain.includes(key)) {
      return path.join(cookieDir, knownSites[key]);
    }
  }

  // Default fallback cookie file (optional)
  return null;
}

export async function execYtDlp(originalUrl, proxy = null) {
  const domainsToTry = [originalUrl];
  const urlObj = new URL(originalUrl);
  const domain = urlObj.hostname.replace("www.", "");
  const fallback = fallbackDomains[domain];

  if (fallback && fallback.length > 0) {
    for (const altDomain of fallback) {
      const altUrl = originalUrl.replace(domain, altDomain);
      domainsToTry.push(altUrl);
    }
  }

  for (const urlToTry of domainsToTry) {
    const domainToTry = new URL(urlToTry).hostname.replace("www.", "");
    const cookieFile = getCookieFile(domainToTry);

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

      console.log(`Trying: ${urlToTry}`);
      const info = await ytdlp(urlToTry, options);
      if (info && info.formats) {
        return info;
      }
    } catch (err) {
      console.warn(`yt-dlp failed for ${urlToTry}:`, err?.stderr || err?.message);
    }
  }

  throw new Error("All fallback attempts failed to fetch video info.");
}
