export const RSS_BASE_URL = "https://tldr.tech/api/rss";

export const FEEDS = [
  "tech",
  "ai",
  "crypto",
  "product",
  "design",
  "dev",
  "devops",
  "marketing",
  "data",
  "fintech",
] as const;

export type FeedName = (typeof FEEDS)[number];

export const DEFAULT_MAX_DAYS = 10;

export const getMaxDays = (): number => {
  const parsedDays = parseInt(
    process.env.MAX_DAYS || `${DEFAULT_MAX_DAYS}`,
    10,
  );
  return Number.isNaN(parsedDays) ? DEFAULT_MAX_DAYS : parsedDays;
};

export const isSupportedFeed = (value: string): value is FeedName =>
  (FEEDS as readonly string[]).includes(value);
