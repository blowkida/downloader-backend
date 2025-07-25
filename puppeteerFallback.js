import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export default async function tryWithPuppeteer(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const hostname = new URL(url).hostname;

    let result = {
      title: "Unknown Title",
      thumbnail: null,
      duration: null,
      formats: [],
    };

    if (hostname.includes("xvideos")) {
      result = await extractXvideos(page);
    } else if (hostname.includes("xhamster")) {
      result = await extractXhamster(page);
    } else if (hostname.includes("pornhat")) {
      result = await extractPornhat(page);
    } else {
      throw new Error("Unsupported domain for Puppeteer fallback.");
    }

    return result;
  } finally {
    await browser.close();
  }
}

// ----------- Custom scrapers for each domain ------------

async function extractXvideos(page) {
  const title = await page.title();
  const videoUrl = await page.$eval("video > source", el => el.src);
  const thumbnail = await page.$eval("meta[property='og:image']", el => el.content);

  return {
    title,
    thumbnail,
    duration: null,
    formats: [
      {
        quality: "Default",
        size: "Unknown",
        url: videoUrl,
      },
    ],
  };
}

async function extractXhamster(page) {
  const title = await page.title();
  const videoUrl = await page.$eval("video > source", el => el.src);
  const thumbnail = await page.$eval("meta[property='og:image']", el => el.content);

  return {
    title,
    thumbnail,
    duration: null,
    formats: [
      {
        quality: "Default",
        size: "Unknown",
        url: videoUrl,
      },
    ],
  };
}

async function extractPornhat(page) {
  const title = await page.title();
  const thumbnail = await page.$eval("meta[property='og:image']", el => el.content);
  const videoUrl = await page.$eval("video > source", el => el.src);

  return {
    title,
    thumbnail,
    duration: null,
    formats: [
      {
        quality: "Default",
        size: "Unknown",
        url: videoUrl,
      },
    ],
  };
}
