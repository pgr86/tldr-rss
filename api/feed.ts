import { FEEDS, isSupportedFeed } from "../src/config";
import { fetchAllFeeds, fetchFeedNews } from "../src/feed";
import { renderHtmlFeed } from "../src/html";
import { renderRssFeed } from "../src/rss";
import { markAsRead, markAsUnread, markAllAsRead } from "../src/readStatus";

const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  json(body: unknown): void;
};

const getQueryParam = (
  value: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const getBaseUrl = (req: RequestLike): string => {
  const forwardedProto = getQueryParam(req.headers["x-forwarded-proto"]);
  const forwardedHost = getQueryParam(req.headers["x-forwarded-host"]);
  const host = forwardedHost || getQueryParam(req.headers.host) || "localhost";
  const protocol = forwardedProto || "https";

  return `${protocol}://${host}`;
};

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  // 1. Handle CORS preflight (OPTIONS method)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).send("");
    return;
  }

  const url = new URL(req.url || "/", getBaseUrl(req));

  // 2. Authentication Check
  const queryPassword = getQueryParam(req.query?.password) || url.searchParams.get("password");
  let isAuthenticated = queryPassword === "Test@123";

  if (!isAuthenticated) {
    const authHeaderRaw = req.headers["authorization"];
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    if (authHeader) {
      const match = authHeader.match(/^Basic\s+(.*)$/i);
      if (match) {
        try {
          const credentials = Buffer.from(match[1], "base64").toString("utf-8");
          const parts = credentials.split(":");
          const password = parts[1];
          if (password === "Test@123") {
            isAuthenticated = true;
          }
        } catch {
          // Ignore base64 decoding errors
        }
      }
    }
  }

  if (!isAuthenticated) {
    res.setHeader("WWW-Authenticate", 'Basic realm="TLDR RSS Reader"');
    res.status(401).send("Unauthorized");
    return;
  }

  const pathname = url.pathname;

  // 3. Mark As Read API Route
  if (pathname === "/mark-read") {
    const link = getQueryParam(req.query?.link) || url.searchParams.get("link");
    if (!link) {
      res.status(400).json({ error: "Missing link parameter" });
      return;
    }
    markAsRead(link);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).json({ success: true });
    return;
  }

  // Mark As Unread API Route
  if (pathname === "/mark-unread") {
    const link = getQueryParam(req.query?.link) || url.searchParams.get("link");
    if (!link) {
      res.status(400).json({ error: "Missing link parameter" });
      return;
    }
    markAsUnread(link);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).json({ success: true });
    return;
  }

  // Mark All As Read API Route
  if (pathname === "/mark-all-read") {
    const linksParam = getQueryParam(req.query?.links) || url.searchParams.get("links");
    if (!linksParam) {
      res.status(400).json({ error: "Missing links parameter" });
      return;
    }
    const links = linksParam.split(",");
    markAllAsRead(links);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).json({ success: true });
    return;
  }

  const feed = getQueryParam(req.query?.feed) || url.searchParams.get("feed");
  const format =
    getQueryParam(req.query?.format) || url.searchParams.get("format") || "rss";

  if (!feed) {
    res.status(400).json({
      error: "Missing feed parameter",
      supportedFeeds: [...FEEDS, "feed"],
    });
    return;
  }

  const isDirect = feed.endsWith("_direct");
  const baseFeed = isDirect ? feed.replace("_direct", "") : feed;

  if (baseFeed !== "feed" && !isSupportedFeed(baseFeed)) {
    res.status(404).json({
      error: `Unsupported feed "${feed}"`,
      supportedFeeds: [
        ...FEEDS,
        "feed",
        ...FEEDS.map((f) => `${f}_direct`),
        "feed_direct",
      ],
    });
    return;
  }

  if (format !== "rss" && format !== "html") {
    res.status(400).json({
      error: `Unsupported format "${format}"`,
      supportedFormats: ["rss", "html"],
    });
    return;
  }

  let news;
  try {
    news = baseFeed === "feed" ? await fetchAllFeeds() : await fetchFeedNews(baseFeed);
  } catch (error) {
    res.status(500).json({
      error: `Failed to load news for ${feed}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  // 4. Safety net filtering of sponsored news (even if they were previously cached)
  const filteredNews = news.filter((item) => {
    const titleLower = item.title.toLowerCase();
    return !(
      titleLower.includes("(sponsor)") ||
      titleLower.includes("(sponsoren)") ||
      titleLower.includes("(sponsored)")
    );
  });

  if (filteredNews.length === 0) {
    res.status(404).json({
      error: `No posts found for ${feed}`,
    });
    return;
  }

  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${FOUR_HOURS_IN_SECONDS}, stale-while-revalidate=3600`,
  );

  if (format === "html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderHtmlFeed(baseFeed, filteredNews));
    return;
  }

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.status(200).send(renderRssFeed(feed, filteredNews, getBaseUrl(req), isDirect));
}
