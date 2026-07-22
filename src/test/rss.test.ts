import { renderRssFeed } from "../rss";

describe("RSS Feed Generation", () => {
  it("should include item images in the rendered RSS", () => {
    const feed = renderRssFeed("test", [
      {
        title: "Test Article",
        link: "https://example.com/article",
        content: "Summary content",
        image: "https://example.com/image.jpg",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ]);

    expect(feed).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
    expect(feed).toContain("<link>https://example.com/article</link>");
    expect(feed).toContain(
      '<media:content url="https://example.com/image.jpg" medium="image"/>',
    );
    expect(feed).toContain(
      '<img src="https://example.com/image.jpg" alt="Test Article" />',
    );
  });

  it("should omit media tags when an item has no image", () => {
    const feed = renderRssFeed("test", [
      {
        title: "Test Article",
        link: "https://example.com/article",
        content: "Summary content",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ]);

    expect(feed).not.toContain("<media:content");
    expect(feed).not.toContain("<img ");
  });

  it("should omit description and content:encoded when direct is true", () => {
    const feed = renderRssFeed(
      "test_direct",
      [
        {
          title: "Test Article",
          link: "https://example.com/article",
          content: "Summary content",
          image: "https://example.com/image.jpg",
          date: new Date("2024-01-15T10:00:00Z").toISOString(),
        },
      ],
      undefined,
      true,
    );

    expect(feed).not.toContain("<description>Summary content</description>");
    expect(feed).not.toContain("<content:encoded>");
    expect(feed).toContain("<title>Test Article</title>");
    expect(feed).toContain("<link>https://example.com/article</link>");
    // media:content can still be present (optional but nice)
    expect(feed).toContain(
      '<media:content url="https://example.com/image.jpg" medium="image"/>',
    );
  });

  it("should format feed title and description when feed ends with _direct", () => {
    const feed = renderRssFeed("tech_direct", [
      {
        title: "Test Article",
        link: "https://example.com/article",
        content: "Summary content",
        date: new Date("2024-01-15T10:00:00Z").toISOString(),
      },
    ]);

    expect(feed).toContain("<title>TLDR TECH Direct Feed</title>");
    expect(feed).toContain(
      "<description>TLDR RSS Feed (Direct Links)</description>",
    );
  });
});
