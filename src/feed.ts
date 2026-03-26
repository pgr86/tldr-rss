import { type FeedName, FEEDS, getMaxDays, RSS_BASE_URL } from "./config";
import { fetchNews, getRSSFeed } from "./news";
import { type News } from "./types";
import { logger } from "./util";

export type NewsWithDate = News & { date: string };

export const fetchFeedNews = async (
  feedName: FeedName,
): Promise<NewsWithDate[]> => {
  const maxDays = getMaxDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  logger.info(
    `Fetching ${feedName} news from the last ${maxDays} days (since ${cutoffDate.toISOString()})`,
  );

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

  return feedNews;
};

export const fetchAllFeeds = async (): Promise<NewsWithDate[]> => {
  const allNews: NewsWithDate[] = [];

  for (const feedName of FEEDS) {
    const feedNews = await fetchFeedNews(feedName);
    allNews.push(...feedNews);
  }

  return allNews;
};
