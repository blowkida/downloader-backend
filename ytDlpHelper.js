import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fallbackMap = {
  'xhamster.com': [
    'xhmaster.desi',
    'xhmaster1.desi',
    'xhaccess.com',
    'xhmaster19.com',
    'xhmaster2.com',
  ],
  // Add more fallback domains here as needed
};

function getCookieFile(url) {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const possiblePaths = [
    path.join(__dirname, 'cookies', `${domain}.txt`),
    path.join(__dirname, 'cookies', `${domain.replace(/\./g, '')}.txt`)
  ];
  return possiblePaths.find(fs.existsSync);
}

async function runYtDlp(targetUrl, originalUrl) {
  const cookieFile = getCookieFile(originalUrl);
  const cmd = [
    'yt-dlp',
    '--dump-json',
    '--no-playlist',
    cookieFile ? `--cookies "${cookieFile}"` : '',
    `"${targetUrl}"`
  ].filter(Boolean).join(' ');

  try {
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout);
  } catch (error) {
    return null;
  }
}

function getFallbackUrls(originalUrl) {
  try {
    const parsed = new URL(originalUrl);
    const host = parsed.hostname;
    const fallbacks = fallbackMap[host];
    if (!fallbacks) return [];
    return fallbacks.map(fb => parsed.href.replace(host, fb));
  } catch {
    return [];
  }
}

async function puppeteerScrape(originalUrl) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(originalUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const content = await page.content();

    const title = await page.title();
    const thumbnail = await page.$eval('video', video => video.poster || '');
    const videoSrc = await page.$eval('video source', s => s.src || '');
    const duration = await page.$eval('video', v => v.duration || 0);

    await browser.close();

    if (!videoSrc) throw new Error('No video source found');

    return {
      title,
      thumbnail,
      duration,
      formats: [
        {
          format_id: 'fallback',
          quality: 'unknown',
          filesize: null,
          url: videoSrc,
          ext: 'mp4'
        }
      ]
    };
  } catch (err) {
    return null;
  }
}

export async function fetchVideoInfo(originalUrl) {
  // 1. Try original
  let info = await runYtDlp(originalUrl, originalUrl);
  if (info) return info;

  // 2. Try fallback domains
  const fallbackUrls = getFallbackUrls(originalUrl);
  for (const url of fallbackUrls) {
    info = await runYtDlp(url, originalUrl);
    if (info) return info;
  }

  // 3. Try Puppeteer
  const puppeteerData = await puppeteerScrape(originalUrl);
  if (puppeteerData) return puppeteerData;

  // 4. All failed
  throw new Error('Failed to retrieve video info using yt-dlp and Puppeteer.');
}
