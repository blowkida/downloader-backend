import { exec } from 'child_process';
import fallbackDomains from './fallbackDomains.js';

const runYtDlpCommand = (url) => {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp "${url}" --dump-single-json --no-warnings --no-call-home --referer "${url}" --geo-bypass`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        return reject(stderr || error.message);
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (err) {
        reject("Failed to parse yt-dlp JSON: " + err.message);
      }
    });
  });
};

export const fetchVideoInfo = async (url) => {
  const domain = new URL(url).hostname;

  const fallbackList = [url];

  if (domain.includes("xhamster")) {
    fallbackDomains.xhamster.forEach(fallback => {
      fallbackList.push(url.replace(domain, fallback));
    });
  }

  for (const testUrl of fallbackList) {
    try {
      const data = await runYtDlpCommand(testUrl);
      if (data?.formats?.length) {
        return data;
      }
    } catch (e) {
      console.warn(`Failed on ${testUrl}:`, e);
    }
  }

  throw new Error("Failed to fetch video info from all sources.");
};
