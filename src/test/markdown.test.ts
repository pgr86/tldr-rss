import { markdownToHtml } from "../markdown";

describe("markdownToHtml", () => {
  it("renders images with a meaningful alt text as a figure", () => {
    const html = markdownToHtml(
      "![Image 1: A chart of results](https://x.io/a.png)",
    );
    expect(html).toContain(
      '<figure><img src="https://x.io/a.png" alt="A chart of results" loading="lazy"><figcaption>A chart of results</figcaption></figure>',
    );
    expect(html).not.toContain("Image 1");
  });

  it("drops placeholder alt texts like 'Image 2'", () => {
    const html = markdownToHtml("![Image 2](https://x.io/b.png)");
    expect(html).toContain(
      '<img src="https://x.io/b.png" alt="" loading="lazy">',
    );
    expect(html).not.toContain("<figcaption>");
  });

  it("renders linked images as an image wrapped in the link", () => {
    const html = markdownToHtml(
      "[![Image 3: Logo](https://x.io/c.png)](https://x.io/page)",
    );
    expect(html).toContain(
      '<a href="https://x.io/page" target="_blank" rel="noopener noreferrer"><img src="https://x.io/c.png"',
    );
    expect(html).not.toContain("](");
  });

  it("renders bullet lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("renders numbered lists", () => {
    expect(markdownToHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("keeps emphasis inside list items intact", () => {
    const html = markdownToHtml("* **bold** item\n* *it* two");
    expect(html).toContain("<li><strong>bold</strong> item</li>");
    expect(html).toContain("<li><em>it</em> two</li>");
  });

  it("escapes raw HTML from the source", () => {
    const html = markdownToHtml("<script>alert(1)</script> hello");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("drops links with non-http protocols but keeps their text", () => {
    const html = markdownToHtml("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("renders inline code escaped", () => {
    expect(markdownToHtml("Use `a<b` now")).toContain("<code>a&lt;b</code>");
  });

  it("renders fenced code blocks", () => {
    expect(markdownToHtml("```\nconst x = 1 < 2;\n```")).toContain(
      "<pre><code>const x = 1 &lt; 2;</code></pre>",
    );
  });

  it("renders horizontal rules", () => {
    expect(markdownToHtml("above\n\n---\n\nbelow")).toContain("<hr>");
  });

  it("still renders headings, quotes, paragraphs and links", () => {
    const html = markdownToHtml(
      "## Title\n\n> quote\n\nPara [link](https://x.io)",
    );
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<blockquote>quote</blockquote>");
    expect(html).toContain(
      '<p>Para <a href="https://x.io" target="_blank" rel="noopener noreferrer">link</a></p>',
    );
  });
});
