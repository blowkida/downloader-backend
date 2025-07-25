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

    if (hostname.includes("xvideos") || hostname.includes("xvideos2")) {
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

export async function extractXvideos(page) {
  try {
    // Accept GDPR/consent popup if present
    await page.goto("https://www.xvideos.com", { waitUntil: "domcontentloaded" });

    const acceptButton = await page.$("button#i_accept"); // Check if "I Accept" button exists
    if (acceptButton) {
      await acceptButton.click();
      await page.waitForTimeout(1000); // Let the page react to click
    }

    await page.goto(page.url(), { waitUntil: "networkidle2" }); // Revisit the actual video page

    const title = await page.title();

    const videoUrl = await page.$eval("video > source", (el) => el.src);
    const thumbnail = await page.$eval(
      "meta[property='og:image']",
      (el) => el.content
    );

    console.log("✅ Puppeteer scraping success for:", title);
    console.log("Extracted video URL:", videoUrl);

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
  } catch (err) {
    console.error("❌ Puppeteer failed to extract XVideos:", err.message);
    return {
      failed: true,
    };
  }
}
export async function extractqorno(page) {
  try {
    // Accept GDPR/consent popup if present
    await page.goto("https://www.qorno.com/", { waitUntil: "domcontentloaded" });

    const acceptButton = await page.$("button#i_accept"); // Check if "I Accept" button exists
    if (acceptButton) {
      await acceptButton.click();
      await page.waitForTimeout(1000); // Let the page react to click
    }

    await page.goto(page.url(), { waitUntil: "networkidle2" }); // Revisit the actual video page

    const title = await page.title();

    const videoUrl = await page.$eval("video > source", (el) => el.src);
    const thumbnail = await page.$eval(
      "meta[property='og:image']",
      (el) => el.content
    );

    console.log("✅ Puppeteer scraping success for:", title);
    console.log("Extracted video URL:", videoUrl);

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
  } catch (err) {
    console.error("❌ Puppeteer failed to extract XVideos:", err.message);
    return {
      failed: true,
    };
  }
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
