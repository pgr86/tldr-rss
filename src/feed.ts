import { getCache, getCacheWithTtl, setCache } from "./cache";
import { type FeedName, FEEDS, getMaxDays, RSS_BASE_URL } from "./config";
import { fetchNews, getRSSFeed } from "./news";
import { type News } from "./types";
import { logger } from "./util";

export type NewsWithDate = News & { date: string };

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const fetchFeedNews = async (
  feedName: FeedName,
): Promise<NewsWithDate[]> => {
  const maxDays = getMaxDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  const cacheKey = `feed_news:${feedName}`;

  // 1. Try to load from cache if it is fresh (less than 15 minutes old)
  const cached = getCacheWithTtl<NewsWithDate[]>(cacheKey, FIFTEEN_MINUTES);
  if (cached && cached.length > 0) {
    logger.info(
      `Using fresh cached news for ${feedName} (${cached.length} articles)`,
    );
    return cached;
  }

  logger.info(
    `Fetching ${feedName} news from the last ${maxDays} days (since ${cutoffDate.toISOString()})`,
  );

  try {
    const feed = `${RSS_BASE_URL}/${feedName}`;
    const rssNews = await getRSSFeed(feed);

    const recentItems = rssNews.items.filter((item) => {
      if (!item.isoDate) return false;
      const itemDate = new Date(item.isoDate);
      return itemDate >= cutoffDate;
    });

    logger.info(
      `Found ${rssNews.items.length} total ${feedName} items, ${recentItems.length} within the last ${maxDays} days`,
    );

    const feedNews: NewsWithDate[] = [];

    for (const item of recentItems) {
      if (!item.link || !item.isoDate) {
        continue;
      }

      logger.info(`Downloading news from ${item.link} for ${item.isoDate}`);
      const news = await fetchNews(item.link);
      logger.debug(`Downloaded ${news.length} articles`);

      for (const currentNews of news) {
        logger.debug(JSON.stringify(currentNews));
        feedNews.push({ ...currentNews, date: item.isoDate });
      }
    }

    // Save to cache on success
    if (feedNews.length > 0) {
      setCache(cacheKey, feedNews);
    }

    return feedNews;
  } catch (error) {
    logger.error(
      `Error fetching news for ${feedName}, checking cache fallback... ${error instanceof Error ? error.message : String(error)}`,
    );

    // 2. Fall back to any cached data (even if expired)
    const fallback = getCache<NewsWithDate[]>(cacheKey);
    if (fallback && fallback.length > 0) {
      logger.info(
        `Successfully fell back to expired cached news for ${feedName} (${fallback.length} articles). Marking cache as fresh.`,
      );
      // Touch/save cache to mark it as fresh for the next 15 minutes to prevent continuous network rate limiting
      setCache(cacheKey, fallback);
      return fallback;
    }

    // If no cache is available at all, rethrow the error
    logger.error(`No cached fallback available for ${feedName}`);
    throw error;
  }
};

export const fetchAllFeeds = async (): Promise<NewsWithDate[]> => {
  const allNews: NewsWithDate[] = [];

  for (const feedName of FEEDS) {
    try {
      const feedNews = await fetchFeedNews(feedName);
      allNews.push(...feedNews);
      // Add a 1-second delay between feed scrapes to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error(
        `Failed to fetch feed ${feedName} during fetchAllFeeds: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue fetching other feeds even if one completely fails
    }
  }

  return allNews;
};
