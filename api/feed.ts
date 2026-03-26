import { FEEDS, isSupportedFeed } from "../src/config";
import { fetchAllFeeds, fetchFeedNews } from "../src/feed";
import { renderHtmlFeed } from "../src/html";
import { renderRssFeed } from "../src/rss";

const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
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
  const url = new URL(req.url || "/", getBaseUrl(req));
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

  if (feed !== "feed" && !isSupportedFeed(feed)) {
    res.status(404).json({
      error: `Unsupported feed "${feed}"`,
      supportedFeeds: [...FEEDS, "feed"],
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

  const news =
    feed === "feed" ? await fetchAllFeeds() : await fetchFeedNews(feed);

  if (news.length === 0) {
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
    res.status(200).send(renderHtmlFeed(feed, news));
    return;
  }

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.status(200).send(renderRssFeed(feed, news, getBaseUrl(req)));
}
