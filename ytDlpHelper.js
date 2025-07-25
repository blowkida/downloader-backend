import ytdlp from "yt-dlp-exec";
import fallbackDomains from "./fallbackDomains.js";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to cookies.txt file
const cookieFilePath = path.join(__dirname, "youtube-cookies.txt");

export async function execYtDlp(originalUrl, proxy = null) {
  const domainsToTry = [originalUrl];

  // Add fallback domains for adult sites
  const url = new URL(originalUrl);
  const domain = url.hostname.replace("www.", "");
  const fallback = fallbackDomains[domain];

  if (fallback && fallback.length > 0) {
    for (const altDomain of fallback) {
      const altUrl = originalUrl.replace(domain, altDomain);
      domainsToTry.push(altUrl);
    }
  }

  // Try each URL until one succeeds
  for (const urlToTry of domainsToTry) {
    try {
      const options = {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
        referer: urlToTry,
        proxy: proxy || undefined,
        args: [
          "--cookies",
          cookieFilePath,
        ],
      };

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
