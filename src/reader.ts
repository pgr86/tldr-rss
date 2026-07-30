import { Readability } from "@mozilla/readability";
import axios from "axios";
import { JSDOM } from "jsdom";

import { logger } from "./util";

export type ArticleData = {
  title: string;
  domain: string;
  originalUrl: string;
  date?: string;
  leadImage?: string;
  contentHtml: string;
  readingTimeMinutes: number;
};

const cleanHtmlForJsdom = (html: string): string =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

const REMOVE_BEFORE_PARSING = [
  "script",
  "style",
  "iframe",
  "svg",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "button",
  "input",
  ".ad",
  ".ads",
  ".advertisement",
  ".cookie",
  ".cookie-banner",
  ".banner",
  ".newsletter",
  ".newsletter-signup",
  ".newsletter-box",
  ".subscribe",
  ".signup",
  ".social-share",
  ".share-buttons",
  ".comments",
  ".related-posts",
  ".sidebar",
  "[class*='newsletter']",
  "[class*='subscribe']",
  "[id*='newsletter']",
  "[id*='subscribe']",
  "[role='banner']",
  "[role='navigation']",
  "[role='complementary']",
  "[role='dialog']",
  "[aria-hidden='true']",
];

export const fetchReaderArticle = async (
  targetUrl: string,
): Promise<ArticleData> => {
  let domain = "";
  try {
    domain = new URL(targetUrl).hostname.replace(/^www\./, "");
  } catch {
    domain = targetUrl;
  }

  logger.info(`Fetching reader article from ${targetUrl}`);

  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    const rawHtml = response.data as string;
    const dom = new JSDOM(cleanHtmlForJsdom(rawHtml), { url: targetUrl });
    const doc = dom.window.document;

    // 1. Meta Lead Image Extraction
    const ogImage = doc
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content");
    const twitterImage = doc
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute("content");
    let leadImage: string | undefined = undefined;

    const candidateImage = ogImage || twitterImage;
    if (candidateImage) {
      try {
        leadImage = new URL(candidateImage, targetUrl).toString();
      } catch {
        leadImage = candidateImage;
      }
    }

    // 2. Date Extraction
    const pubDateMeta =
      doc
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute("content") ||
      doc.querySelector('meta[name="pubdate"]')?.getAttribute("content") ||
      doc.querySelector("time")?.getAttribute("datetime") ||
      doc.querySelector("time")?.textContent?.trim();

    let formattedDate: string | undefined = undefined;
    if (pubDateMeta) {
      try {
        const dateObj = new Date(pubDateMeta);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString("de-DE", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        formattedDate = pubDateMeta;
      }
    }

    // Pre-clean noisy elements before feeding to Readability
    REMOVE_BEFORE_PARSING.forEach((sel) => {
      try {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {
        // Ignore invalid selectors
      }
    });

    // 3. Parse with Mozilla Readability (Firefox Reader Mode Engine)
    const reader = new Readability(doc);
    const parsedArticle = reader.parse();

    const title =
      parsedArticle?.title?.trim() || doc.title?.trim() || "Artikel";

    const rawContentHtml = parsedArticle?.content || "";

    // Parse the clean content HTML with JSDOM for post-processing & deduplication
    const contentDom = new JSDOM(rawContentHtml, { url: targetUrl });
    const contentDoc = contentDom.window.document;

    // A. Resolve relative links and images to absolute URLs
    contentDoc.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href) {
        try {
          a.setAttribute("href", new URL(href, targetUrl).toString());
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        } catch {
          // Keep original
        }
      }
    });

    contentDoc.querySelectorAll("img").forEach((img) => {
      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("srcset");
      if (src) {
        try {
          const cleanSrc = src.split(",")[0].split(" ")[0];
          img.setAttribute("src", new URL(cleanSrc, targetUrl).toString());
          img.removeAttribute("srcset");
          img.removeAttribute("data-src");
          img.setAttribute("loading", "lazy");
        } catch {
          img.remove();
        }
      } else {
        img.remove();
      }
    });

    // B. Deduplicate Lead Image:
    // If the first image in content is identical to leadImage (or if leadImage isn't set, make first image leadImage and remove from body)
    const imagesInContent = Array.from(contentDoc.querySelectorAll("img"));
    if (imagesInContent.length > 0) {
      const firstImgSrc = imagesInContent[0].getAttribute("src");
      if (firstImgSrc) {
        if (!leadImage) {
          leadImage = firstImgSrc;
          imagesInContent[0].remove();
        } else if (
          leadImage === firstImgSrc ||
          leadImage.includes(firstImgSrc) ||
          firstImgSrc.includes(leadImage)
        ) {
          // Remove duplicate lead image from body content
          imagesInContent[0].remove();
        }
      }
    }

    // C. Remove duplicate H1 title at start of content
    const firstH1 = contentDoc.querySelector("h1");
    if (firstH1) {
      const h1Text = firstH1.textContent?.trim().toLowerCase() || "";
      const articleTitleText = title.toLowerCase();
      if (h1Text === articleTitleText || articleTitleText.includes(h1Text)) {
        firstH1.remove();
      }
    }

    // D. Filter out leftover newsletter promo / subscribe paragraphs
    contentDoc.querySelectorAll("p, div, blockquote").forEach((el) => {
      const text = el.textContent?.trim().toLowerCase() || "";
      if (
        (text.includes("subscribe to") ||
          text.includes("newsletter") ||
          text.includes("abonnieren sie") ||
          text.includes("get the latest news in your inbox") ||
          text.includes("sign up for our")) &&
        text.length < 150
      ) {
        el.remove();
      }
    });

    const contentHtml = contentDoc.body.innerHTML.trim();
    const wordCount = (contentDoc.body.textContent || "").split(/\s+/).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    if (!contentHtml || (contentDoc.body.textContent?.trim().length || 0) < 50) {
      return {
        title,
        domain,
        originalUrl: targetUrl,
        date: formattedDate,
        leadImage,
        contentHtml: `<p><em>Inhalt konnte nicht automatisch extrahiert werden. Bitte öffne die Originalseite.</em></p>`,
        readingTimeMinutes: 1,
      };
    }

    return {
      title,
      domain,
      originalUrl: targetUrl,
      date: formattedDate,
      leadImage,
      contentHtml,
      readingTimeMinutes,
    };
  } catch (error) {
    logger.info(
      `Failed to fetch reader article from ${targetUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {
      title: "Artikel laden fehlgeschlagen",
      domain,
      originalUrl: targetUrl,
      contentHtml: `<p>Der Artikel konnte nicht im Reader Mode geladen werden. Öffne bitte die Originalseite.</p>`,
      readingTimeMinutes: 1,
    };
  }
};

export const renderReaderHtml = (article: ArticleData): string => `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(article.title)} - Reader Mode</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: #111827;
            --card-hover: #1f2937;
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --text-muted: #6b7280;
            --accent-color: #38bdf8;
            --accent-glow: rgba(56, 189, 248, 0.15);
            --border-color: rgba(255, 255, 255, 0.08);
            --font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: var(--font-family);
            line-height: 1.7;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Slim, custom scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: var(--bg-color);
        }
        ::-webkit-scrollbar-thumb {
            background: #27272a;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #3f3f46;
        }

        header {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .nav-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            color: var(--text-secondary);
            font-size: 0.82rem;
            font-weight: 500;
            padding: 6px 12px;
            border-radius: 8px;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .btn:hover {
            color: var(--text-primary);
            background-color: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .btn-primary {
            background-color: var(--accent-glow);
            color: var(--accent-color);
            border-color: rgba(56, 189, 248, 0.3);
            font-weight: 600;
        }

        .btn-primary:hover {
            background-color: rgba(56, 189, 248, 0.25);
            color: #7dd3fc;
            border-color: rgba(56, 189, 248, 0.5);
        }

        .reader-container {
            width: 100%;
            max-width: 740px;
            margin: 0 auto;
            padding: 24px 16px 60px 16px;
            flex: 1;
        }

        .article-header {
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .domain-badge {
            display: inline-block;
            background-color: rgba(56, 189, 248, 0.12);
            color: var(--accent-color);
            font-size: 0.75rem;
            font-weight: 600;
            padding: 3px 10px;
            border-radius: 20px;
            border: 1px solid rgba(56, 189, 248, 0.2);
            margin-bottom: 12px;
            text-transform: lowercase;
        }

        .article-title {
            font-size: 1.65rem;
            font-weight: 700;
            line-height: 1.3;
            letter-spacing: -0.02em;
            color: var(--text-primary);
            margin-bottom: 12px;
        }

        .article-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .lead-image {
            width: 100%;
            max-height: 380px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 24px;
            border: 1px solid var(--border-color);
        }

        /* Article Body Styling - Larger font for Reader Mode */
        .article-body {
            font-size: 1.12rem;
            line-height: 1.75;
            color: #e5e7eb;
        }

        .article-body p {
            margin-bottom: 1.4em;
        }

        .article-body h1,
        .article-body h2,
        .article-body h3,
        .article-body h4 {
            color: var(--text-primary);
            font-weight: 700;
            margin-top: 1.6em;
            margin-bottom: 0.6em;
            line-height: 1.35;
        }

        .article-body h2 { font-size: 1.35rem; }
        .article-body h3 { font-size: 1.2rem; }

        .article-body a {
            color: var(--accent-color);
            text-decoration: underline;
            text-underline-offset: 3px;
        }

        .article-body a:hover {
            color: #7dd3fc;
        }

        .article-body ul,
        .article-body ol {
            margin-bottom: 1.4em;
            padding-left: 24px;
        }

        .article-body li {
            margin-bottom: 0.5em;
        }

        .article-body blockquote {
            border-left: 3px solid var(--accent-color);
            background: rgba(255, 255, 255, 0.03);
            padding: 12px 18px;
            margin: 1.5em 0;
            border-radius: 0 8px 8px 0;
            color: var(--text-secondary);
            font-style: italic;
        }

        .article-body img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 1.5em 0;
            display: block;
            border: 1px solid var(--border-color);
        }

        .article-body pre {
            background-color: #1e293b;
            padding: 14px 18px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 0.9rem;
            line-height: 1.5;
            margin: 1.5em 0;
            border: 1px solid var(--border-color);
        }

        .article-body code {
            font-family: monospace;
            background-color: rgba(255, 255, 255, 0.08);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .original-banner {
            margin-top: 40px;
            padding: 20px;
            border-radius: 12px;
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }

        .original-banner p {
            font-size: 0.88rem;
            color: var(--text-secondary);
        }

        footer {
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
            padding: 12px;
            text-align: center;
            font-size: 0.72rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <header>
        <div class="nav-actions">
            <button class="btn" onclick="if (history.length > 1) { history.back(); } else { window.close(); }">
                ← Zurück
            </button>
        </div>
        <div class="nav-actions">
            <a href="${escapeHtmlAttr(article.originalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                Original öffnen ↗
            </a>
        </div>
    </header>

    <main class="reader-container">
        <article>
            <div class="article-header">
                <span class="domain-badge">${escapeHtml(article.domain)}</span>
                <h1 class="article-title">${escapeHtml(article.title)}</h1>
                <div class="article-meta">
                    ${article.date ? `<span>${escapeHtml(article.date)}</span> •` : ""}
                    <span>~${article.readingTimeMinutes} Min. Lesezeit</span>
                </div>
            </div>

            ${
              article.leadImage
                ? `<img src="${escapeHtmlAttr(article.leadImage)}" alt="" class="lead-image" />`
                : ""
            }

            <div class="article-body">
                ${article.contentHtml}
            </div>

            <div class="original-banner">
                <p>Du liest im Reader Mode. Möchtest du die vollständige Originalseite besuchen?</p>
                <a href="${escapeHtmlAttr(article.originalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                    Originalseite auf ${escapeHtml(article.domain)} öffnen ↗
                </a>
            </div>
        </article>
    </main>

    <footer>
        Reader Mode • TLDR RSS Reader
    </footer>

    <script>
        // Preserve password query param on original link if present
        const urlParams = new URLSearchParams(window.location.search);
        const password = urlParams.get('password');
        if (password) {
            document.querySelectorAll('a').forEach(link => {
                try {
                    const hrefUrl = new URL(link.href, window.location.origin);
                    if (hrefUrl.origin === window.location.origin) {
                        hrefUrl.searchParams.set('password', password);
                        link.href = hrefUrl.pathname + hrefUrl.search;
                    }
                } catch (e) {}
            });
        }
    </script>
</body>
</html>`;

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
