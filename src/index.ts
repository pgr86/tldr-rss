import { setFailed, summary } from "@actions/core";

import { FEEDS } from "./config";
import { fetchFeedNews, NewsWithDate } from "./feed";
import { writeHtmlFeed } from "./html";
import { writeRssFeed } from "./rss";
import { logger } from "./util";

const fetchFeeds = async (): Promise<NewsWithDate[]> => {
  const allNews: NewsWithDate[] = [];

  for (const feedName of FEEDS) {
    const feedNews = await fetchFeedNews(feedName);
    allNews.push(...feedNews);

    await writeRssFeed(feedName, feedNews);

    // Generate HTML page for tech feed only
    if (feedName === "tech") {
      await writeHtmlFeed(feedName, feedNews);
    }
  }

  logger.debug(`All news: ${JSON.stringify(allNews)}`);

  await writeRssFeed("feed", allNews);
  return allNews;
};

const summarizeNews = async (news: NewsWithDate[]): Promise<void> => {
  let text = summary
    .addHeading(`RSS news for ${new Date().toDateString()}`, 1)
    .addTable([
      [{ data: "Source", header: true }],
      ...FEEDS.map((feed) => [`<a href=${feed}>${feed}</a>`]),
    ])
    .addEOL();
  for (const { title, content, date, link } of news) {
    text = text
      .addHeading(`<a href=${link}>${title}</a>`, 3)
      .addEOL()
      .addHeading(new Date(date).toDateString(), 5)
      .addEOL()
      .addQuote(content)
      .addEOL();
  }

  await text.write();
};

fetchFeeds().then(summarizeNews).catch(setFailed);
