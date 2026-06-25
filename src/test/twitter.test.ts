import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { type NewsWithDate } from "../feed";
import { formatTweet, isTwitterConfigured, postFeedUpdates } from "../twitter";

// Mock the Twitter SDK so no real network calls are made.
const tweetMock = jest.fn();
jest.mock("twitter-api-v2", () => {
  return {
    TwitterApi: jest.fn().mockImplementation(() => {
      return {
        v2: { tweet: tweetMock },
      };
    }),
  };
});

const TWITTER_ENV = [
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET_KEY",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_TOKEN_SECRET",
] as const;

const setCredentials = (): void => {
  for (const key of TWITTER_ENV) {
    process.env[key] = "test-value";
  }
};

const clearCredentials = (): void => {
  for (const key of TWITTER_ENV) {
    delete process.env[key];
  }
};

const makeItem = (n: number, date: string): NewsWithDate => {
  return {
    title: `Article ${n}`,
    link: `https://example.com/article-${n}`,
    content: `Content ${n}`,
    date,
  };
};

describe("formatTweet", () => {
  it("keeps short titles intact and appends the link", () => {
    expect(formatTweet("Hello world", "https://example.com")).toBe(
      "Hello world https://example.com",
    );
  });

  it("truncates long titles so the tweet fits within 280 characters", () => {
    const longTitle = "x".repeat(400);
    const tweet = formatTweet(longTitle, "https://example.com/some/long/path");
    // Title portion + space + the real link length must stay within budget.
    // The link is counted as 23 chars by t.co, so the rendered length is <= 280.
    expect(tweet.endsWith(" https://example.com/some/long/path")).toBe(true);
    expect(tweet).toContain("…");
    const renderedLength =
      tweet.length - "https://example.com/some/long/path".length + 23;
    expect(renderedLength).toBeLessThanOrEqual(280);
  });
});

describe("isTwitterConfigured", () => {
  afterEach(clearCredentials);

  it("is false when credentials are missing", () => {
    clearCredentials();
    expect(isTwitterConfigured()).toBe(false);
  });

  it("is true when all credentials are present", () => {
    setCredentials();
    expect(isTwitterConfigured()).toBe(true);
  });
});

describe("postFeedUpdates", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "twitter-state-"));
    process.env.TWITTER_STATE_DIR = stateDir;
    tweetMock.mockReset();
    tweetMock.mockResolvedValue({});
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.TWITTER_STATE_DIR;
    clearCredentials();
  });

  it("does nothing when credentials are not configured", async () => {
    clearCredentials();
    await postFeedUpdates("ai", [makeItem(1, "2026-06-25T00:00:00Z")]);
    expect(tweetMock).not.toHaveBeenCalled();
    expect(existsSync(join(stateDir, "posted-ai.json"))).toBe(false);
  });

  it("seeds state without posting on the first run", async () => {
    setCredentials();
    await postFeedUpdates("ai", [
      makeItem(1, "2026-06-25T00:00:00Z"),
      makeItem(2, "2026-06-24T00:00:00Z"),
    ]);
    expect(tweetMock).not.toHaveBeenCalled();

    const state = JSON.parse(
      readFileSync(join(stateDir, "posted-ai.json"), "utf8"),
    ) as string[];
    expect(state).toHaveLength(2);
  });

  it("posts only new articles on subsequent runs", async () => {
    setCredentials();
    // First run seeds article 1.
    await postFeedUpdates("ai", [makeItem(1, "2026-06-24T00:00:00Z")]);
    expect(tweetMock).not.toHaveBeenCalled();

    // Second run has a new article 2.
    await postFeedUpdates("ai", [
      makeItem(2, "2026-06-25T00:00:00Z"),
      makeItem(1, "2026-06-24T00:00:00Z"),
    ]);
    expect(tweetMock).toHaveBeenCalledTimes(1);
    expect(tweetMock).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/article-2"),
    );
  });

  it("respects MAX_TWEETS_PER_RUN", async () => {
    setCredentials();
    process.env.MAX_TWEETS_PER_RUN = "2";
    // Seed with an unrelated article so it is not treated as a first run.
    await postFeedUpdates("ai", [makeItem(0, "2026-06-20T00:00:00Z")]);

    await postFeedUpdates("ai", [
      makeItem(1, "2026-06-25T00:00:00Z"),
      makeItem(2, "2026-06-24T00:00:00Z"),
      makeItem(3, "2026-06-23T00:00:00Z"),
      makeItem(0, "2026-06-20T00:00:00Z"),
    ]);

    expect(tweetMock).toHaveBeenCalledTimes(2);
    delete process.env.MAX_TWEETS_PER_RUN;
  });
});
