import ytDlp from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const exec = ytDlp;
const COOKIES_PATH = path.resolve("cookies/xhamster.txt");

export const execYtDlp = async (url) => {
  console.log("Trying yt-dlp for:", url);

  const args = [
    "--no-warnings",
    "--no-check-certificate",
    "--geo-bypass",
    "--no-playlist",
    "--dump-json",
    "--no-call-home",
    "--referer", url,
  ];

  if (fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }

  try {
    const result = await exec(url, {
      execPath: "yt-dlp", // assumes available in system PATH (e.g. on Render)
      args,
    });
    return result;
  } catch (err) {
    console.warn("yt-dlp failed for:", url);
    throw err;
  }
};

// 🧪 Puppeteer fallback for final rescue
const launchBrowser = async () => {
  return await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

const readCookiesForPuppeteer = async (page) => {
  if (!fs.existsSync(COOKIES_PATH)) return;
  const raw = fs.readFileSync(COOKIES_PATH, "utf8");
  const cookies = raw
    .split("\n")
    .filter(line => !line.startsWith("#") && line.trim())
    .map(line => {
      const parts = line.split("\t");
      return {
        domain: parts[0],
        path: parts[2],
        secure: parts[3] === "TRUE",
        expires: parseInt(parts[4]),
        name: parts[5],
        value: parts[6],
      };
    });

  await page.setCookie(...cookies);
};

export const puppeteerFallback = async (url) => {
  console.log("Trying Puppeteer as last resort...");
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await readCookiesForPuppeteer(page);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const title = await page.title();
    const thumbnail = await page.$eval("meta[property='og:image']", el => el.content);
    const duration = await page.$eval("meta[itemprop='duration']", el => el.content);
    return {
      title,
      thumbnail,
      duration,
      formats: [],
    };
  } catch (err) {
    console.error("Puppeteer fallback failed:", err.message);
    throw new Error("Puppeteer failed: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
};
