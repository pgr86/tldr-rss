/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import axios from "axios";
import { JSDOM } from "jsdom";
import Parser from "rss-parser";

import { News } from "./types";
import { logger } from "./util";
import { getCache, setCache } from "./cache";

export const getRSSFeed = async (
  feed: string,
): Promise<Parser.Output<Record<string, unknown>>> => {
  const parser = new Parser();
  logger.info(`Fetching feed for ${feed}`);

  const maxRetries = 6; // 6 retries + 1 initial attempt = 7 total attempts
  let attemptCount = 0;

  while (attemptCount <= maxRetries) {
    try {
      return await parser.parseURL(feed);
    } catch (error: unknown) {
      attemptCount++;

      // Check if this is a 429 error
      // Some libraries throw errors with a response object, others just with a message
      const errorWithResponse = error as {
        response?: { status?: number; headers?: Record<string, string> };
      };
      const is429Error =
        errorWithResponse?.response?.status === 429 ||
        (error instanceof Error && error.message.includes("Status code 429"));

      if (!is429Error || attemptCount > maxRetries) {
        // If it's not a 429 error, or we've exhausted all retries, throw the error
        if (is429Error && attemptCount > maxRetries) {
          logger.warn(
            `Failed to fetch RSS feed for ${feed} after ${maxRetries + 1} attempts due to rate limiting`,
          );
        }
        throw error;
      }

      // Extract retry delay from Retry-After header or default to 30 seconds
      const retryAfter = errorWithResponse.response?.headers?.["retry-after"];
      const delaySeconds =
        retryAfter && !isNaN(parseInt(retryAfter, 10))
          ? parseInt(retryAfter, 10)
          : 30;
      const delayMs = delaySeconds * 1000;

      logger.warn(
        `Rate limited (429) for feed ${feed}. Retrying in ${delaySeconds} seconds (attempt ${attemptCount}/${maxRetries + 1})`,
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached, but TypeScript needs this to understand the function always returns or throws
  throw new Error("Unexpected end of retry loop");
};

const cleanHtmlForJsdom = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
};

export const fetchNews = async (url: string): Promise<News[]> => {
  const cacheKey = `news:${url}`;
  const cached = getCache<News[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  logger.info(`Downloading site from ${url}`);
  try {
    const siteFetch = await axios.get(url);
    const site = new JSDOM(cleanHtmlForJsdom(siteFetch.data as string));
    const doc = site.window.document;

    // We get all the headers
    const headers = doc.querySelectorAll("h3");
    logger.info(`Found ${headers.length} headers. Parsing them`);

    const articlePromises = Array.from(headers.values()).map(async (header) => {
      const title = header.textContent;
      const link = header.parentElement?.getAttribute("href");
      const content =
        header.parentElement?.parentElement?.querySelector("div")?.textContent;
      if (!title || !link || !content) {
        logger.debug(
          `Skipping null elements: ${title ?? "title"} ${url} ${
            content ?? "content"
          }`,
        );
        return null;
      }

      const image = await fetchArticleImage(link);
      return { title, link, content, image } as News;
    });

    const parsedArticles = await Promise.all(articlePromises);
    const news = parsedArticles.filter((item): item is News => item !== null);

    if (news.length > 0) {
      setCache(cacheKey, news);
    }
    return news;
  } catch (error) {
    logger.info(
      `Failed to fetch news from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
};

const IMAGE_META_SELECTORS = [
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:src"]',
  'meta[itemprop="image"]',
  'link[rel="image_src"]',
];

const fetchArticleImage = async (url: string): Promise<string | undefined> => {
  const cacheKey = `image:${url}`;
  const cachedObj = getCache<{ image: string | undefined }>(cacheKey);
  if (cachedObj) {
    return cachedObj.image;
  }

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      responseType: "text",
    });
    const site = new JSDOM(cleanHtmlForJsdom(response.data as string), { url });
    const doc = site.window.document;

    let image: string | undefined = undefined;

    for (const selector of IMAGE_META_SELECTORS) {
      const element = doc.querySelector(selector);
      const value =
        element?.getAttribute("content") || element?.getAttribute("href");

      if (value) {
        const normalizedValue = normalizeImageUrl(value, url);
        if (normalizedValue) {
          image = normalizedValue;
          break;
        }
      }
    }

    if (!image) {
      const fallbackImage = doc.querySelector("article img, main img, img");
      const fallbackSrc =
        fallbackImage?.getAttribute("src") ||
        fallbackImage?.getAttribute("data-src");
      if (fallbackSrc) {
        image = normalizeImageUrl(fallbackSrc, url);
      }
    }

    setCache(cacheKey, { image });
    return image;
  } catch (error) {
    logger.debug(
      `Failed to fetch article image from ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    setCache(cacheKey, { image: undefined });
    return undefined;
  }
};

const normalizeImageUrl = (
  candidate: string,
  pageUrl: string,
): string | undefined => {
  if (!candidate || candidate.startsWith("data:")) {
    return undefined;
  }

  try {
    return new URL(candidate, pageUrl).toString();
  } catch {
    return undefined;
  }
};
