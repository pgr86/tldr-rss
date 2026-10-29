import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { getCache } from "./cache";
import { FEEDS } from "./config";

// The Merkliste: articles saved across all feeds. Each entry is a snapshot taken when
// the article was saved, so it outlives the feed caches (they only cover MAX_DAYS).

export type SavedArticle = {
  link: string;
  title: string;
  content: string;
  image?: string;
  date: string;
  /** Feed the article was saved from, e.g. "ai" */
  feed: string;
  /** Epoch milliseconds */
  savedAt: number;
};

type CachedPost = {
  title: string;
  link: string;
  content: string;
  image?: string;
  date: string;
};

// Resolved on every call so tests can point the store elsewhere
const bookmarksFile = (): string =>
  process.env.BOOKMARKS_FILE ||
  path.join(process.cwd(), ".cache", "bookmarks.json");

const isSavedArticle = (value: unknown): value is SavedArticle => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.link === "string" &&
    typeof entry.title === "string" &&
    typeof entry.savedAt === "number"
  );
};

// The list is small, so it is read from disk on every call instead of being kept in memory
const load = (): SavedArticle[] => {
  try {
    const file = bookmarksFile();
    if (!existsSync(file)) return [];
    const data: unknown = JSON.parse(readFileSync(file, "utf-8"));
    return Array.isArray(data) ? data.filter(isSavedArticle) : [];
  } catch (error) {
    console.error("Failed to load bookmarks:", error);
    return [];
  }
};

const save = (bookmarks: SavedArticle[]): void => {
  try {
    const file = bookmarksFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(bookmarks), "utf-8");
  } catch (error) {
    console.error("Failed to save bookmarks:", error);
  }
};

/** Saved articles, most recently saved first */
export const getBookmarks = (): SavedArticle[] =>
  load().sort((first, second) => second.savedAt - first.savedAt);

export const getBookmarkedLinks = (): string[] =>
  getBookmarks().map((bookmark) => bookmark.link);

export const isBookmarked = (link: string): boolean =>
  load().some((bookmark) => bookmark.link === link);

/** Looks the article up in the cached feeds, together with the feed it belongs to */
export const findCachedArticle = (
  link: string,
): (CachedPost & { feed: string }) | null => {
  for (const feed of FEEDS) {
    const cached = getCache<CachedPost[]>(`feed_news:${feed}`);
    if (!Array.isArray(cached)) continue;
    const post = cached.find((item) => item.link === link);
    if (post) return { ...post, feed };
  }
  return null;
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Saves an article. Title, teaser and image come from the feed cache; what the
 * client sends is only used when the article is no longer cached.
 * Returns false when nothing is known about the article.
 */
export const addBookmark = (
  link: string,
  fallback: Record<string, unknown> = {},
): boolean => {
  const bookmarks = load();
  if (bookmarks.some((bookmark) => bookmark.link === link)) return true;

  const cached = findCachedArticle(link);
  const title = cached?.title || optionalString(fallback.title);
  if (!title) return false;

  const fallbackDate = optionalString(fallback.date);
  bookmarks.push({
    link,
    title,
    content: cached?.content ?? optionalString(fallback.content) ?? "",
    image: cached?.image || optionalString(fallback.image),
    date:
      cached?.date ||
      (fallbackDate && !Number.isNaN(new Date(fallbackDate).getTime())
        ? fallbackDate
        : new Date().toISOString()),
    feed: cached?.feed || optionalString(fallback.feed) || "",
    savedAt: Date.now(),
  });
  save(bookmarks);
  return true;
};

export const removeBookmark = (link: string): void => {
  const bookmarks = load();
  const remaining = bookmarks.filter((bookmark) => bookmark.link !== link);
  if (remaining.length !== bookmarks.length) save(remaining);
};
