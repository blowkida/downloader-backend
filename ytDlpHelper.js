import ytDlpExec from "yt-dlp-exec"; // ✅ Correct way to import CommonJS module
import fallbackDomains from "./fallbackDomains.js";
import tryWithPuppeteer from "./puppeteerFallback.js"; // ✅ Correct default import

export async function fetchVideoInfo(url) {
  const baseOptions = {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
    referer: url,
    // Add proxy or cookies here if needed
  };

  try {
    const info = await ytDlpExec(url, baseOptions); // ✅ yt-dlp attempt
    return extractVideoData(info);
  } catch (err) {
    console.warn("yt-dlp failed on original URL:", err.message);
  }

  // 🔁 Try fallback domains
  const fallbackUrl = getFallbackUrl(url);
  if (fallbackUrl) {
    try {
      const info = await ytDlpExec(fallbackUrl, baseOptions);
      return extractVideoData(info);
    } catch (err) {
      console.warn("yt-dlp failed on fallback domain:", err.message);
    }
  }

  // 🧠 Final fallback: try Puppeteer
  console.log("Trying Puppeteer fallback...");
  const puppeteerResult = await tryWithPuppeteer(url);
  return puppeteerResult;
}

function getFallbackUrl(originalUrl) {
  for (const [base, fallbacks] of Object.entries(fallbackDomains)) {
    if (originalUrl.includes(base)) {
      for (const domain of fallbacks) {
        const altUrl = originalUrl.replace(base, domain);
        return altUrl;
      }
    }
  }
  return null;
}

function extractVideoData(info) {
  if (!info.formats || !info.formats.length) throw new Error("No formats found");

  const formats = info.formats
    .filter(f => f.filesize && f.url)
    .map(f => ({
      quality: f.format_note || f.format_id,
      size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(2) + " MB" : "N/A",
      url: f.url,
    }));

  return {
    title: info.title,
    thumbnail: info.thumbnail,
    duration: info.duration,
    formats,
  };
}
