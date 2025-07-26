// server/ytDlpHelper.js

import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { URL } from 'url';

const execFileAsync = promisify(execFile);

const fallbackDomainMap = {
  'xhamster.com': [
    'xhamster.desi', 'xhamster1.desi', 'xhmaster.desi', 'xhaccess.com', 'xhmaster19.com', 'xhmaster2.com'
  ],
  'xvideos.com': [
    'xvideos2.com', 'xvideos4.com'
  ],
  'pornhat.com': [
    'pornhat.in', 'pornhat.org'
  ]
};

function getBaseDomain(inputUrl) {
  try {
    const hostname = new URL(inputUrl).hostname;
    for (const base in fallbackDomainMap) {
      const variants = fallbackDomainMap[base];
      if (hostname === base || variants.includes(hostname)) return base;
    }
    return hostname;
  } catch (err) {
    return null;
  }
}

function getCookiesPath(url) {
  const baseDomain = getBaseDomain(url);
  const cookiesFile = `cookies/${baseDomain}.txt`;
  return fs.existsSync(path.resolve(cookiesFile)) ? cookiesFile : null;
}

export async function fetchVideoInfo(url, proxy = null) {
  const ytDlpPath = 'yt-dlp'; // assuming globally installed or set in PATH
  const baseArgs = [
    url,
    '--dump-json',
    '--no-warnings',
    '--no-call-home',
    '--no-check-certificate',
    '--no-playlist',
    '--no-cache-dir',
    '--restrict-filenames'
  ];

  const cookies = getCookiesPath(url);
  if (cookies) {
    baseArgs.push('--cookies', path.resolve(cookies));
  }

  if (proxy) {
    baseArgs.push('--proxy', proxy);
  }

  try {
    const { stdout } = await execFileAsync(ytDlpPath, baseArgs, { maxBuffer: 500 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(err.stderr || err.message);
  }
}
