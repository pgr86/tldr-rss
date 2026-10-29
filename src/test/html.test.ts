import { readFile, unlink } from "fs/promises";

import { renderHtmlFeed, writeHtmlFeed } from "../html";
import { linkHash } from "../postMeta";

describe("HTML Feed Generation", () => {
  const testPosts = [
    {
      title: "Test Article 1",
      link: "https://example.com/1",
      content: "This is test content 1",
      date: new Date("2024-01-15T10:00:00Z").toISOString(),
    },
    {
      title: "Test Article 2",
      link: "https://example.com/2",
      content: "This is test content 2",
      date: new Date("2024-01-16T10:00:00Z").toISOString(),
    },
    {
      title: "Test Article 3",
      link: "https://example.com/3",
      content: "This is test content 3",
      date: new Date("2024-01-14T10:00:00Z").toISOString(),
    },
  ];

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink("./site/test.html");
    } catch (error) {
      // File might not exist, ignore error
    }
  });

  it("should create an HTML file with articles", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain('<html lang="de">');
    expect(content).toContain("TLDR Test");
  });

  it("should include all articles in the HTML with reader links", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain("Test Article 1");
    expect(content).toContain("Test Article 2");
    expect(content).toContain("Test Article 3");
    expect(content).toContain(
      "/reader?url=" + encodeURIComponent("https://example.com/1"),
    );
    expect(content).toContain("This is test content 1");
  });

  it("should sort articles by date (most recent first)", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    // Article 2 (2024-01-16) should appear before Article 1 (2024-01-15)
    const article2Index = content.indexOf("Test Article 2");
    const article1Index = content.indexOf("Test Article 1");
    const article3Index = content.indexOf("Test Article 3");

    expect(article2Index).toBeLessThan(article1Index);
    expect(article1Index).toBeLessThan(article3Index);
  });

  it("should include ISO 8601 dates", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain("2024-01-15T10:00:00.000Z");
    expect(content).toContain("2024-01-16T10:00:00.000Z");
    expect(content).toContain("2024-01-14T10:00:00.000Z");
  });

  it("should limit articles to maxArticles parameter", async () => {
    const manyPosts = Array.from({ length: 100 }, (_, i) => {
      return {
        title: `Article ${i}`,
        link: `https://example.com/${i}`,
        content: `Content ${i}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    await writeHtmlFeed("test", manyPosts, 10);

    const content = await readFile("./site/test.html", "utf8");

    // Should contain first 10 articles
    expect(content).toContain("Article 0");
    expect(content).toContain("Article 9");

    // Should not contain articles beyond limit
    expect(content).not.toContain("Article 10");
    expect(content).not.toContain("Article 99");
  });

  it("should escape HTML special characters", async () => {
    const postsWithHtml = [
      {
        title: "Article with <script>alert('XSS')</script>",
        link: 'https://example.com/xss?param=value&other="test"',
        content: "Content with & < > \" ' characters",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ];

    await writeHtmlFeed("test", postsWithHtml);

    const content = await readFile("./site/test.html", "utf8");

    // Should escape dangerous characters in content
    expect(content).not.toContain("<script>alert");
    expect(content).toContain("&lt;script&gt;");
    expect(content).toContain("&amp;");
    expect(content).toContain("&quot;");

    // Should escape URL attributes properly
    expect(content).toContain(
      'href="/reader?url=https%3A%2F%2Fexample.com%2Fxss%3Fparam%3Dvalue%26other%3D%22test%22"',
    );
  });

  it("should escape single quotes in URLs", async () => {
    const postsWithSingleQuotes = [
      {
        title: "Test Article",
        link: "https://example.com/article?name=O'Brien",
        content: "Test content",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ];

    await writeHtmlFeed("test", postsWithSingleQuotes);

    const content = await readFile("./site/test.html", "utf8");

    // Single quotes in encodeURIComponent URLs should be formatted in href
    expect(content).toContain(
      'href="/reader?url=https%3A%2F%2Fexample.com%2Farticle%3Fname%3DO&#039;Brien"',
    );
  });

  it("should include 'mehr' link element and initMoreToggle handler", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain(
      '<span class="more-link" role="button" tabindex="0">mehr</span>',
    );
    expect(content).toContain("initMoreToggle(document)");
  });

  it("should include mouse drag scrolling for tabs and mouse swipe gestures for feed items", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain("initTabScrolling()");
    expect(content).toContain("container.addEventListener('mousedown'");
    expect(content).toContain("item.addEventListener('mousedown'");
    expect(content).toContain("window.addEventListener('mousemove'");
    expect(content).toContain("window.addEventListener('mouseup'");
  });

  it("should persist read status locally using the original article link", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain(`data-link="${testPosts[0].link}"`);
    expect(content).toContain("localStorage.setItem(READ_STATUS_KEY");
    expect(content).toContain("applyLocalReadStatus();");
    expect(content).toContain("markAsRead(item.dataset.link, linkElement)");
  });

  it("should wire up the installable app shell and view transitions", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain(
      '<link rel="manifest" href="/manifest.webmanifest">',
    );
    expect(content).toContain("viewport-fit=cover");
    expect(content).toContain("@view-transition");
    expect(content).toContain("navigator.serviceWorker.register('/sw.js')");
    expect(content).toContain('<div id="app-splash"');
    expect(content).toContain('<span id="app-ready" hidden></span>');
    expect(content).toContain("initPullToRefresh()");
  });

  it("should render split view layout and reader pane on large screens", async () => {
    await writeHtmlFeed("test", testPosts);

    const content = await readFile("./site/test.html", "utf8");

    expect(content).toContain('<div class="app-layout">');
    expect(content).toContain('<div class="feed-pane">');
    expect(content).toContain('<aside class="reader-pane" id="reader-pane"');
    expect(content).toContain('<iframe id="reader-frame"');
    expect(content).toContain('<button id="split-toggle-btn"');
    expect(content).toContain(
      '<div class="reader-empty-state" id="reader-empty-state">',
    );
    expect(content).toContain(
      '<div class="reader-loading-state" id="reader-loading-state"',
    );
    expect(content).toContain("@media (min-width: 900px)");
    expect(content).toContain(".feed-item.is-selected");
    expect(content).toContain("openArticleInSplitView");
    expect(content).toContain("revealReader");
    expect(content).toContain("reader-ready");
    expect(content).toContain("closeSplitView");
    expect(content).toContain("toggleSplitView");
    expect(content).toContain("handleShortcut");
    expect(content).toContain("isLargeScreen()");
    expect(content).toContain(".reader-loading-state[hidden]");
  });

  it("should throw error if no posts are provided", async () => {
    await expect(writeHtmlFeed("test", [])).rejects.toThrow(
      "No posts found for test",
    );
  });
  describe("skimmable list and desktop chrome", () => {
    const posts = [
      {
        title: "Test Article 1 (5 minute read)",
        link: "https://www.example.com/1",
        content: "This is test content 1",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ];

    it("moves the reading time out of the title into the meta row", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain(">Test Article 1</h2>");
      expect(html).toContain("5 Min.");
      expect(html).not.toContain("(5 minute read)");
    });

    it("shows the source host in the meta row", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain('class="feed-source">example.com<');
    });

    it("renders the list bar, the all-read hint and the shortcut dialog", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain('id="list-bar"');
      expect(html).toContain('id="unread-count"');
      expect(html).toContain("Alle gelesen");
      expect(html).toContain('id="all-read-hint"');
      expect(html).toContain('id="shortcuts-btn"');
      expect(html).toContain('id="shortcut-dialog"');
    });

    it("explains header buttons with tooltips including their shortcut", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain('data-tip="Split View an / aus   V"');
    });

    it("drops the empty-state close button and the stacked loading indicator", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).not.toContain("reader-pane-close-btn");
      expect(html).not.toContain("reader-loading-indicator");
    });
  });
  describe("reader loading", () => {
    const posts = [
      {
        title: "Loading Article",
        link: "https://example.com/loading",
        content: "Content",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ];

    it("renders one static skeleton and a separate error state", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain('id="reader-error-state"');
      expect(html).not.toContain("loadingState.innerHTML");
      expect(html).not.toContain("Artikel wird geladen");
    });

    it("dims the previous article and delays the skeleton", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain(".reader-frame.is-stale");
      expect(html).toContain("SKELETON_DELAY_MS = 200");
    });

    it("prefetches the next article only through the service worker", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain("function prefetchReader(link)");
      expect(html).toContain("navigator.serviceWorker.controller");
    });

    it("skips view transitions inside the embedded reader", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toContain("window.self !== window.top");
      expect(html).toContain("skipTransition()");
    });
  });
  describe("unread counts on tabs", () => {
    const posts = [
      {
        title: "Counted Article",
        link: "https://example.com/counted",
        content: "Content",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ];

    it("embeds the hashed links of other feeds", () => {
      const html = renderHtmlFeed("test", posts, 50, { ai: ["abc"] });
      expect(html).toContain('id="feed-links"');
      expect(html).toContain('{"ai":["abc"]}');
      expect(html).toContain('data-feed="ai"');
      expect(html).toContain('class="tab-count"');
    });

    it("embeds an empty map by default", () => {
      const html = renderHtmlFeed("test", posts);
      expect(html).toMatch(/id="feed-links">\{\}<\/script>/);
    });

    it("hashes links in the browser exactly like the server", () => {
      const html = renderHtmlFeed("test", posts);
      const source = html.match(/function linkHash\(link\) \{[\s\S]*?\n {8}\}/);
      expect(source).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const clientHash = new Function(`${source?.[0]}; return linkHash;`)() as (
        link: string,
      ) => string;
      ["https://example.com/a?utm_source=tldr", "https://ex.io/ü"].forEach(
        (link) => expect(clientHash(link)).toBe(linkHash(link)),
      );
    });
  });
});
