import { fetchReaderArticle, renderReaderHtml } from "../reader";

describe("Reader Mode", () => {
  it("should render reader HTML page with article content", () => {
    const html = renderReaderHtml({
      title: "Test Reader Article",
      domain: "example.com",
      originalUrl: "https://example.com/article",
      date: "30. Juli 2026",
      leadImage: "https://example.com/image.jpg",
      contentHtml: "<p>This is a test paragraph in reader mode.</p>",
      readingTimeMinutes: 2,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Reader Article");
    expect(html).toContain("example.com");
    expect(html).toContain("https://example.com/article");
    expect(html).toContain("This is a test paragraph in reader mode.");
    expect(html).toContain("Original öffnen");
    expect(html).toContain("Reader Mode");
  });

  it("should handle error when fetching invalid article URL gracefully", async () => {
    const article = await fetchReaderArticle(
      "https://invalid-url-that-does-not-exist.invalid",
    );

    expect(article.domain).toBe("invalid-url-that-does-not-exist.invalid");
    expect(article.contentHtml).toContain("schützt ihre Inhalte mit einem aktiven Bot-Schutz");
  });
});
