import { fetchReaderArticle, renderReaderHtml } from "../reader";

jest.setTimeout(15000);

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
    expect(html).toContain('id="close-btn"');
    expect(html).toContain('id="open-tab-btn"');
    expect(html).toContain("html.is-embedded");
    expect(html).toContain("reader-keydown");
    expect(html).toContain("close-reader");
    expect(html).toContain("reader-ready");
    expect(html).not.toContain('id="summary-btn"');
  });

  it("should offer a summary only when enabled and the article was extracted", () => {
    const article = {
      title: "Test Reader Article",
      domain: "example.com",
      originalUrl: "https://example.com/article",
      contentHtml: "<p>This is a test paragraph in reader mode.</p>",
      readingTimeMinutes: 2,
    };

    const html = renderReaderHtml(article, { summarize: true });
    expect(html).toContain('id="summary-btn"');
    expect(html).toContain("Zusammenfassen");
    expect(html).toContain('id="summary-card"');

    const fallback = renderReaderHtml(
      { ...article, isFallback: true },
      { summarize: true },
    );
    expect(fallback).not.toContain('id="summary-btn"');
  });

  it("should handle error when fetching invalid article URL gracefully", async () => {
    const article = await fetchReaderArticle(
      "https://invalid-url-that-does-not-exist.invalid",
    );

    expect(article.domain).toBe("invalid-url-that-does-not-exist.invalid");
    expect(article.contentHtml).toContain("schützt ihre Inhalte mit einem aktiven Paywall- oder Bot-Schutz");
  });
});
