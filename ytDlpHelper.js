import ytdlp from "yt-dlp-exec";

export const execYtDlp = async (url) => {
  return await ytdlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    referer: url,
    geoBypass: true,
    // Use proxy if needed
    proxy: process.env.PROXY || "http://138.197.68.35:4857", 
  });
};
