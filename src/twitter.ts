import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { TwitterApi } from "twitter-api-v2";

import { type NewsWithDate } from "./feed";
import { logger } from "./util";

// t.co wraps every URL to a fixed length regardless of the real URL.
const TCO_LINK_LENGTH = 23;
const TWEET_MAX_LENGTH = 280;
const DEFAULT_MAX_TWEETS_PER_RUN = 5;

const getStateDir = (): string =>
  process.env.TWITTER_STATE_DIR || ".twitter-state";

const getStateFile = (feedName: string): string =>
  join(getStateDir(), `posted-${feedName}.json`);

const getMaxTweetsPerRun = (): number => {
  const parsed = parseInt(
    process.env.MAX_TWEETS_PER_RUN || `${DEFAULT_MAX_TWEETS_PER_RUN}`,
    10,
  );
  return Number.isNaN(parsed) || parsed < 0
    ? DEFAULT_MAX_TWEETS_PER_RUN
    : parsed;
};

/**
 * Returns a configured Twitter client, or null when credentials are missing.
 * Missing credentials are treated as "posting disabled" so that feed
 * generation keeps working locally and in CI without secrets.
 */
export const getTwitterClient = (): TwitterApi | null => {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET_KEY;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return null;
  }

  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
};

export const isTwitterConfigured = (): boolean => getTwitterClient() !== null;

const loadPostedLinks = (feedName: string): Set<string> => {
  const file = getStateFile(feedName);
  if (!existsSync(file)) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch (error) {
    logger.warn(
      `Could not read Twitter state from ${file}: ${
        error instanceof Error ? error.message : String(error)
      }. Starting with an empty state.`,
    );
  }
  return new Set();
};

const savePostedLinks = (feedName: string, links: Set<string>): void => {
  const file = getStateFile(feedName);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify([...links], null, 2), "utf8");
};

/** Builds a tweet body that fits within Twitter's 280 character limit. */
export const formatTweet = (title: string, link: string): string => {
  const trimmedTitle = title.trim();
  // Reserve room for the (t.co-wrapped) link plus a separating space.
  const available = TWEET_MAX_LENGTH - TCO_LINK_LENGTH - 1;

  const text =
    trimmedTitle.length > available
      ? `${trimmedTitle.slice(0, available - 1).trimEnd()}…`
      : trimmedTitle;

  return `${text} ${link}`;
};

/**
 * Posts newly seen articles of a feed to Twitter/X.
 *
 * Behaviour:
 * - No-op when credentials are not configured.
 * - On the very first run (no state file yet) it seeds the state without
 *   posting, so a backlog of older articles is not dumped at once.
 * - Otherwise posts up to MAX_TWEETS_PER_RUN previously unseen articles
 *   (newest first) and records them as posted.
 */
export const postFeedUpdates = async (
  feedName: string,
  items: NewsWithDate[],
): Promise<void> => {
  const client = getTwitterClient();
  if (!client) {
    logger.info(
      `Twitter credentials not configured — skipping posting for ${feedName}.`,
    );
    return;
  }

  const posted = loadPostedLinks(feedName);
  const isFirstRun = posted.size === 0;

  // Deduplicate by link and keep newest first.
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (!item.link || seen.has(item.link)) {
      return false;
    }
    seen.add(item.link);
    return true;
  });
  uniqueItems.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (isFirstRun) {
    for (const item of uniqueItems) {
      posted.add(item.link);
    }
    savePostedLinks(feedName, posted);
    logger.info(
      `First Twitter run for ${feedName}: seeded ${posted.size} existing articles without posting.`,
    );
    return;
  }

  const newItems = uniqueItems.filter((item) => !posted.has(item.link));
  if (newItems.length === 0) {
    logger.info(`No new ${feedName} articles to post to Twitter.`);
    return;
  }

  const maxPerRun = getMaxTweetsPerRun();
  const toPost = newItems.slice(0, maxPerRun);
  logger.info(
    `Posting ${toPost.length} new ${feedName} article(s) to Twitter` +
      (newItems.length > toPost.length
        ? ` (${newItems.length - toPost.length} more will follow on the next run).`
        : "."),
  );

  for (const item of toPost) {
    const tweet = formatTweet(item.title, item.link);
    try {
      await client.v2.tweet(tweet);
      posted.add(item.link);
      logger.info(`Tweeted: ${item.title}`);
    } catch (error) {
      logger.error(
        `Failed to tweet "${item.title}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Stop on the first failure (likely auth or rate limit) so the
      // remaining items stay unposted and are retried next run.
      break;
    }
  }

  savePostedLinks(feedName, posted);
};
