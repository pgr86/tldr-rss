/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import axios from "axios";
import { JSDOM } from "jsdom";
import Parser from "rss-parser";

import { getCache, setCache } from "./cache";
import { News } from "./types";
import { logger } from "./util";

export const getRSSFeed = async (
  feed: string,
  maxRetries = 1,
): Promise<Parser.Output<Record<string, unknown>>> => {
  const parser = new Parser();
  logger.info(`Fetching feed for ${feed}`);

  let attemptCount = 0;

  while (attemptCount <= maxRetries) {
    try {
      return await parser.parseURL(feed);
    } catch (error: unknown) {
      attemptCount++;

      // Check if this is a 429 error
      const errorWithResponse = error as {
        response?: { status?: number; headers?: Record<string, string> };
      };
      const is429Error =
        errorWithResponse?.response?.status === 429 ||
        (error instanceof Error && error.message.includes("Status code 429"));

      if (!is429Error || attemptCount > maxRetries) {
        if (is429Error && attemptCount > maxRetries) {
          logger.warn(
            `Failed to fetch RSS feed for ${feed} after ${maxRetries + 1} attempts due to rate limiting`,
          );
        }
        throw error;
      }

      // Extract retry delay from Retry-After header or default to 5 seconds
      const retryAfter = errorWithResponse.response?.headers?.["retry-after"];
      const delaySeconds =
        retryAfter && !isNaN(parseInt(retryAfter, 10))
          ? parseInt(retryAfter, 10)
          : 5;
      const delayMs = delaySeconds * 1000;

      logger.warn(
        `Rate limited (429) for feed ${feed}. Retrying in ${delaySeconds} seconds (attempt ${attemptCount}/${maxRetries + 1})`,
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Unexpected end of retry loop");
};

const cleanHtmlForJsdom = (html: string): string =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

export const fetchNews = async (url: string): Promise<News[]> => {
  if (url.includes("leadershipintech.com")) {
    return fetchLeadershipNews(url);
  }

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

      // Filter out sponsored news
      const titleLower = title.toLowerCase();
      if (
        titleLower.includes("(sponsor)") ||
        titleLower.includes("(sponsoren)") ||
        titleLower.includes("(sponsored)")
      ) {
        logger.debug(`Skipping sponsored article: ${title}`);
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

export const fetchLeadershipNews = async (url: string): Promise<News[]> => {
  const cacheKey = `news:${url}`;
  const cached = getCache<News[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  logger.info(`Downloading Leadership in Tech site from ${url}`);
  try {
    const siteFetch = await axios.get(url);
    const site = new JSDOM(cleanHtmlForJsdom(siteFetch.data as string), { url });
    const doc = site.window.document;

    const campaign = doc.querySelector(".campaign");
    if (!campaign) {
      logger.info(`No .campaign container found in ${url}`);
      return [];
    }

    const articles: Array<{ title: string; link: string; content: string }> = [];

    // Parse main article paragraphs inside .campaign
    const paragraphs = Array.from(campaign.querySelectorAll("p"));
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const anchor = p.querySelector("a");
      if (!anchor) continue;

      const rawTitle = anchor.textContent?.trim();
      const rawHref = anchor.getAttribute("href");
      if (!rawTitle || !rawHref) continue;

      // Filter sponsored articles
      const fullPText = p.textContent?.toLowerCase() || "";
      if (
        fullPText.includes("sponsored by") ||
        rawTitle.toLowerCase().includes("(sponsor)") ||
        rawTitle.toLowerCase().includes("(sponsored)")
      ) {
        logger.debug(`Skipping sponsored leadership article: ${rawTitle}`);
        continue;
      }

      // Check next paragraph for summary content
      let content = "";
      const nextElem = p.nextElementSibling;
      if (
        nextElem &&
        nextElem.tagName.toLowerCase() === "p" &&
        !nextElem.querySelector("a")
      ) {
        content = nextElem.textContent?.trim() || "";
      }

      const absoluteLink = normalizeImageUrl(rawHref, url) || rawHref;
      articles.push({
        title: rawTitle,
        link: absoluteLink,
        content: content || rawTitle,
      });
    }

    // Also parse list items in campaign if present (sections like industry/security)
    const listAnchors = Array.from(campaign.querySelectorAll("ul li a"));
    for (const anchor of listAnchors) {
      const rawTitle = anchor.textContent?.trim();
      const rawHref = anchor.getAttribute("href");
      if (!rawTitle || !rawHref) continue;

      const titleLower = rawTitle.toLowerCase();
      if (
        titleLower.includes("(sponsor)") ||
        titleLower.includes("(sponsored)")
      ) {
        continue;
      }

      const absoluteLink = normalizeImageUrl(rawHref, url) || rawHref;
      if (articles.some((item) => item.link === absoluteLink)) {
        continue;
      }

      articles.push({
        title: rawTitle,
        link: absoluteLink,
        content: rawTitle,
      });
    }

    const articlePromises = articles.map(async (art) => {
      const image = await fetchArticleImage(art.link);
      return { ...art, image } as News;
    });

    const news = await Promise.all(articlePromises);

    if (news.length > 0) {
      setCache(cacheKey, news);
    }
    return news;
  } catch (error) {
    logger.info(
      `Failed to fetch leadership news from ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
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
