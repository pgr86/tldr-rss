import { writeFile } from "fs/promises";
import { logger } from "./util";

type Post = {
  title: string;
  date: string;
  content: string;
  link: string;
  image?: string;
};

/**
 * Generates a minimal HTML page listing articles for AI consumption
 * @param feedName - Name of the feed (e.g., "tech")
 * @param posts - Array of posts to include
 * @param maxArticles - Maximum number of articles to include (default: 50)
 */
export const writeHtmlFeed = async (
  feedName: string,
  posts: Post[],
  maxArticles = 50,
 ): Promise<void> => {
  logger.info(`Creating HTML feed for ${feedName} 📄`);

  await writeFile(
    `./site/${feedName}.html`,
    renderHtmlFeed(feedName, posts, maxArticles),
    "utf8",
  );
};

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    // Clear hours to compare calendar days
    const cleanDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const cleanNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = cleanNow.getTime() - cleanDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    
    return date.toLocaleDateString("de-DE", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  } catch {
    return dateStr;
  }
};

export const renderHtmlFeed = (
  feedName: string,
  posts: Post[],
  maxArticles = 50,
): string => {
  if (posts.length === 0) {
    throw new Error(`No posts found for ${feedName}`);
  }

  // Sort posts by date (most recent first)
  const sortedPosts = posts
    .sort(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime(),
    )
    .slice(0, maxArticles);

  const formattedFeedName = feedName.charAt(0).toUpperCase() + feedName.slice(1);

  // Generate responsive, beautiful HTML optimized for Vivaldi sidebar and panels
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="TLDR ${formattedFeedName} Feed Reader">
    <title>TLDR ${formattedFeedName}</title>
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
            --border-color: rgba(255, 255, 255, 0.06);
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
            line-height: 1.5;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        /* Slim, custom scrollbars */
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

        /* Header block styling */
        header {
            background: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-title-container {
            display: flex;
            flex-direction: column;
        }

        header h1 {
            font-size: 1.1rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        header h1::before {
            content: "";
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: var(--accent-color);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--accent-color);
        }

        header p {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 1px;
        }

        .badge {
            background-color: var(--accent-glow);
            color: var(--accent-color);
            font-size: 0.7rem;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            border: 1px solid rgba(56, 189, 248, 0.2);
        }

        /* Main feed list area */
        main {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* Feed item container cards */
        .feed-item {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .feed-item:hover {
            transform: translateY(-1px);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            background-color: var(--card-hover);
        }

        .feed-link {
            text-decoration: none;
            color: inherit;
            display: block;
            padding: 12px;
        }

        .feed-content-wrapper {
            display: flex;
            gap: 12px;
            align-items: flex-start;
        }

        .feed-text-block {
            flex: 1;
            min-width: 0; /* Prevents text overflow breaking layout */
        }

        .feed-item-title {
            font-size: 0.92rem;
            font-weight: 600;
            line-height: 1.35;
            color: var(--text-primary);
            margin-bottom: 4px;
            transition: color 0.15s ease;
        }

        .feed-item:hover .feed-item-title {
            color: var(--accent-color);
        }

        .feed-item-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .feed-item-description {
            font-size: 0.82rem;
            color: var(--text-secondary);
            line-height: 1.45;
            display: -webkit-box;
            -webkit-line-clamp: 4; /* Truncate description at 4 lines for panel display */
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Thumbnail preview styling */
        .feed-thumbnail-container {
            width: 60px;
            height: 60px;
            flex-shrink: 0;
            border-radius: 6px;
            overflow: hidden;
            background-color: #1e293b;
            border: 1px solid var(--border-color);
        }

        .feed-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }

        .feed-item:hover .feed-thumbnail {
            transform: scale(1.05);
        }

        footer {
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
            padding: 8px 16px;
            text-align: center;
            font-size: 0.68rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <header>
        <div class="header-title-container">
            <h1>TLDR ${formattedFeedName}</h1>
            <p>Aktuelle Artikel aus dem TLDR Feed</p>
        </div>
        <span class="badge">${feedName}</span>
    </header>
    <main>
        ${sortedPosts
          .map(
            (post) => `        <article class="feed-item">
            <a href="${escapeHtmlAttr(post.link)}" target="_blank" class="feed-link" rel="noopener noreferrer">
                <div class="feed-content-wrapper">
                    <div class="feed-text-block">
                        <h2 class="feed-item-title">${escapeHtml(post.title)}</h2>
                        <div class="feed-item-meta">
                            <span>${escapeHtml(formatDate(post.date))}</span>
                        </div>
                        <p class="feed-item-description">${escapeHtml(post.content)}</p>
                    </div>
                    ${
                      post.image
                        ? `                    <div class="feed-thumbnail-container">
                        <img src="${escapeHtmlAttr(post.image)}" alt="" class="feed-thumbnail" loading="lazy" />
                    </div>`
                        : ""
                    }
                </div>
            </a>
        </article>`,
          )
          .join("\n")}
    </main>
    <footer>
        Stand: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' })}
    </footer>
</body>
</html>`;
};

/**
 * Escapes HTML special characters to prevent XSS
 */
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

/**
 * Escapes HTML attribute values (for href, src, etc.)
 * URLs need to escape HTML entities but preserve URL structure
 */
function escapeHtmlAttr(text: string): string {
  // For attributes, we need to escape quotes and ampersands
  // Other HTML entities are fine in attribute values
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
