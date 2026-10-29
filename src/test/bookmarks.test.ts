import { rmSync } from "fs";

import handler from "../../api/feed";
import {
  addBookmark,
  getBookmarkedLinks,
  getBookmarks,
  isBookmarked,
  removeBookmark,
} from "../bookmarks";
import { getCache } from "../cache";
import { renderHtmlFeed, renderSavedFeed } from "../html";

jest.mock("../cache", () => {
  return {
    ...jest.requireActual<typeof import("../cache")>("../cache"),
    getCache: jest.fn(),
  };
});

const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;

const aiPost = {
  title: "Cached AI Article (4 minute read)",
  link: "https://example.com/ai",
  content: "Teaser from the feed",
  image: "https://example.com/ai.png",
  date: "2026-10-20T10:00:00.000Z",
};

const respond = async (
  url: string,
  method = "POST",
  body?: unknown,
): Promise<{ status: number; body: unknown }> => {
  const result: { status: number; body: unknown } = { status: 200, body: "" };
  const res = {
    status: (code: number) => {
      result.status = code;
      return res;
    },
    setHeader: () => undefined,
    send: (value: string) => {
      result.body = value;
    },
    json: (value: unknown) => {
      result.body = value;
    },
  };
  const parsed = new URL(url, "http://localhost");
  await handler(
    {
      headers: { host: "localhost" },
      query: {
        ...Object.fromEntries(parsed.searchParams),
        password: "Test@123",
      },
      url,
      method,
      body,
    },
    res,
  );
  return result;
};

beforeEach(() => {
  rmSync(process.env.BOOKMARKS_FILE as string, { force: true });
  mockedGetCache.mockImplementation((key: string) =>
    key === "feed_news:ai" ? [aiPost] : null,
  );
});

describe("bookmark store", () => {
  it("snapshots a cached article together with its feed", () => {
    expect(addBookmark(aiPost.link)).toBe(true);
    const [saved] = getBookmarks();
    expect(saved).toMatchObject({ ...aiPost, feed: "ai" });
    expect(typeof saved.savedAt).toBe("number");
    expect(isBookmarked(aiPost.link)).toBe(true);
  });

  it("prefers the cache over what the client sends", () => {
    addBookmark(aiPost.link, { title: "Spoofed", feed: "tech" });
    expect(getBookmarks()[0]).toMatchObject({
      title: aiPost.title,
      feed: "ai",
    });
  });

  it("falls back to client details for articles no longer cached", () => {
    expect(
      addBookmark("https://example.com/old", {
        title: "Old Article",
        content: "Old teaser",
        feed: "design",
        date: "not a date",
      }),
    ).toBe(true);
    const [saved] = getBookmarks();
    expect(saved).toMatchObject({
      title: "Old Article",
      content: "Old teaser",
      feed: "design",
    });
    expect(Number.isNaN(new Date(saved.date).getTime())).toBe(false);
  });

  it("refuses articles it knows nothing about", () => {
    expect(addBookmark("https://example.com/unknown")).toBe(false);
    expect(getBookmarks()).toEqual([]);
  });

  it("does not duplicate and lists the most recently saved first", () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1000);
    addBookmark(aiPost.link);
    now.mockReturnValue(2000);
    addBookmark("https://example.com/b", { title: "B" });
    addBookmark(aiPost.link);
    now.mockRestore();
    expect(getBookmarkedLinks()).toEqual([
      "https://example.com/b",
      aiPost.link,
    ]);
  });

  it("removes bookmarks", () => {
    addBookmark(aiPost.link);
    removeBookmark(aiPost.link);
    expect(isBookmarked(aiPost.link)).toBe(false);
  });
});

describe("Merkliste routes", () => {
  it("saves, reports and removes an article", async () => {
    const link = encodeURIComponent(aiPost.link);
    expect((await respond(`/save?link=${link}`)).body).toEqual({
      success: true,
      saved: true,
    });
    expect((await respond(`/save-status?link=${link}`, "GET")).body).toEqual({
      saved: true,
    });
    await respond(`/unsave?link=${link}`);
    expect((await respond(`/save-status?link=${link}`, "GET")).body).toEqual({
      saved: false,
    });
  });

  it("uses the JSON body for uncached articles and 404s without one", async () => {
    const link = encodeURIComponent("https://example.com/gone");
    expect((await respond(`/save?link=${link}`)).status).toBe(404);
    const saved = await respond(
      `/save?link=${link}`,
      "POST",
      JSON.stringify({ title: "Gone", feed: "dev" }),
    );
    expect(saved.status).toBe(200);
    expect(getBookmarks()[0]).toMatchObject({ title: "Gone", feed: "dev" });
  });

  it("renders the Merkliste page, also when it is empty", async () => {
    const empty = await respond("/saved.html?feed=saved&format=html", "GET");
    expect(empty.status).toBe(200);
    expect(empty.body).toContain("Noch nichts gemerkt");

    addBookmark(aiPost.link);
    const page = await respond("/saved.html?feed=saved&format=html", "GET");
    expect(page.body).toContain("Cached AI Article");
    expect(page.body).not.toContain("Noch nichts gemerkt");
  });
});

describe("Merkliste rendering", () => {
  it("adds the Merkliste tab and a save button to every card", () => {
    const html = renderHtmlFeed("ai", [{ ...aiPost }], 50, {}, [aiPost.link]);
    expect(html).toContain('href="/saved.html"');
    expect(html).toContain('data-feed="saved"');
    expect(html).toMatch(/class="feed-item[^"]*is-saved[^"]*has-thumb"/);
    expect(html).toContain('class="save-btn" aria-pressed="true"');
    expect(html).toContain(
      `<script type="application/json" id="saved-links">${JSON.stringify([aiPost.link])}</script>`,
    );
  });

  it("names the feed of every saved article", () => {
    const html = renderSavedFeed([
      { ...aiPost, feed: "ai", savedAt: 1 },
      { ...aiPost, link: "https://example.com/d", feed: "design", savedAt: 2 },
    ]);
    expect(html).toContain("<title>Merkliste</title>");
    expect(html).toContain('<span class="feed-origin">AI</span>');
    expect(html).toContain('<span class="feed-origin">Design</span>');
    expect(html).toMatch(/class="tab-btn tab-saved active"/);
  });
});
