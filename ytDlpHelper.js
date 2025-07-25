import ytdlp from "yt-dlp-exec";
import fallbackDomains from "./fallbackDomains.js";

// Main function to execute yt-dlp with fallback and optional proxy
export async function execYtDlp(originalUrl, proxy = null) {
  const domainsToTry = [originalUrl];

  // Extract hostname
  const url = new URL(originalUrl);
  const domain = url.hostname.replace("www.", "");

  // Add fallback domains if available
  const fallback = fallbackDomains[domain];
  if (fallback && Array.isArray(fallback)) {
    fallback.forEach((altDomain) => {
      const altUrl = originalUrl.replace(domain, altDomain);
      domainsToTry.push(altUrl);
    });
  }

  // Attempt each domain variant
  for (const urlToTry of domainsToTry) {
    try {
      const options = {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        referer: urlToTry,
        preferFreeFormats: true,
        proxy: proxy || undefined,
      };

      const info = await ytdlp(urlToTry, options);
      if (info?.formats) {
        return info;
      }
    } catch (err) {
      console.warn(`yt-dlp failed for ${urlToTry}:`, err?.stderr || err?.message);
    }
  }

  // If all attempts fail
  throw new Error("All fallback attempts failed to fetch video info.");
}
