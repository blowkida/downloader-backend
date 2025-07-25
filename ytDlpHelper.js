import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

const execPromise = util.promisify(exec);

const fallbackDomains = {
  'xhamster.com': [
    'xhmaster.desi',
    'xhmaster1.desi',
    'xhaccess.com',
    'xhmaster19.com',
    'xhmaster2.com'
  ]
};

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function buildYtDlpCommand(url, cookiesPath) {
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--restrict-filenames',
    '--no-check-certificate',
    '--ignore-errors',
    `"${url}"`
  ];

  if (cookiesPath) {
    args.unshift(`--cookies "${cookiesPath}"`);
  }

  return `yt-dlp ${args.join(' ')}`;
}

async function runYtDlp(url, domain) {
  const domainName = domain || getDomain(url);
  const cookiesPath = path.resolve('cookies', `${domainName}.txt`);
  const hasCookies = await fs.access(cookiesPath).then(() => true).catch(() => false);

  const cmd = buildYtDlpCommand(url, hasCookies ? cookiesPath : null);

  try {
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout);
  } catch (err) {
    return null;
  }
}

async function puppeteerFallback(url) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const content = await page.content();
    await browser.close();

    return {
      title: 'Fallback Title',
      duration: 0,
      formats: [],
      thumbnail: '',
      htmlContent: content
    };
  } catch (err) {
    return null;
  }
}

export async function fetchVideoInfo(originalUrl) {
  const domain = getDomain(originalUrl);
  const fallbackList = fallbackDomains[domain] || [];

  // Try original URL
  let info = await runYtDlp(originalUrl);
  if (info) return info;

  // Try fallback domains
  for (const altDomain of fallbackList) {
    const altUrl = originalUrl.replace(domain, altDomain);
    info = await runYtDlp(altUrl, altDomain);
    if (info) return info;
  }

  // Try Puppeteer fallback
  info = await puppeteerFallback(originalUrl);
  return info;
}
