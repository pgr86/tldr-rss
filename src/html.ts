import { writeFile } from "fs/promises";

import { FEEDS } from "./config";
import { PWA_BODY_END, renderPwaBodyStart, renderPwaHead } from "./pwa";
import { isRead } from "./readStatus";
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
    const cleanDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const cleanNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = cleanNow.getTime() - cleanDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Heute";
    } else if (diffDays === 1) {
      return "Gestern";
    } else if (diffDays < 7) {
      return `vor ${diffDays} Tagen`;
    }

    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const getDisplayName = (feed: string): string => {
  if (feed === "ai") return "AI";
  if (feed === "devops") return "DevOps";
  return feed.charAt(0).toUpperCase() + feed.slice(1);
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

  const formattedFeedName = getDisplayName(feedName);

  // Generate tab HTML links
  const tabsHtml = FEEDS.map((f) => {
    const active = f === feedName;
    const displayName = getDisplayName(f);
    return `<a href="/${f}.html" class="tab-btn ${active ? "active" : ""}">${displayName}</a>`;
  }).join("\n                ");

  // Generate responsive, beautiful HTML optimized for Vivaldi sidebar and panels
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    ${renderPwaHead()}
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="description" content="${feedName === "leadership" ? "Leadership in Tech Feed Reader" : `TLDR ${formattedFeedName} Feed Reader`}">
    <title>${feedName === "leadership" ? "Leadership in Tech" : `TLDR ${formattedFeedName}`}</title>
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
            height: 100dvh;
            overflow: hidden;
            overscroll-behavior: none;
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
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: calc(12px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px)) 8px calc(16px + env(safe-area-inset-left, 0px));
            view-transition-name: app-header;
        }

        .header-top {
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

        /* Header actions container */
        .header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-action-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        @media (hover: hover) {
            .header-action-btn:hover {
                color: var(--accent-color);
                background: var(--accent-glow);
                border-color: rgba(56, 189, 248, 0.3);
                transform: scale(1.05);
            }
        }

        .header-action-btn:active {
            transform: scale(0.92);
            color: var(--accent-color);
        }

        /* Feed tabs navigation */
        .feed-tabs-container {
            width: 100%;
            overflow-x: auto;
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
            cursor: grab;
            user-select: none;
            -webkit-user-select: none;
        }
        .feed-tabs-container.is-dragging {
            cursor: grabbing;
        }
        .feed-tabs-container::-webkit-scrollbar {
            display: none; /* Hide scrollbar for Chrome, Safari, Opera */
        }

        .feed-tabs {
            display: flex;
            gap: 6px;
            padding-bottom: 4px;
            width: max-content;
        }

        .tab-btn {
            text-decoration: none;
            color: var(--text-secondary);
            font-size: 0.78rem;
            font-weight: 500;
            padding: 5px 11px;
            border-radius: 20px;
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-color);
            transition: all 0.2s ease;
            white-space: nowrap;
            user-select: none;
            -webkit-user-drag: none;
        }

        @media (hover: hover) {
            .tab-btn:hover {
                color: var(--text-primary);
                background-color: rgba(255, 255, 255, 0.08);
                border-color: rgba(255, 255, 255, 0.15);
            }
        }

        .tab-btn:active {
            transform: scale(0.95);
        }

        .tab-btn.active {
            view-transition-name: active-tab;
            color: #0b0f19;
            background-color: var(--accent-color);
            border-color: var(--accent-color);
            font-weight: 600;
            box-shadow: 0 0 12px var(--accent-glow);
        }

        /* Main feed list area */
        main {
            flex: 1;
            overflow-y: auto;
            overscroll-behavior-y: contain;
            -webkit-overflow-scrolling: touch;
            padding: 12px calc(12px + env(safe-area-inset-right, 0px)) 12px calc(12px + env(safe-area-inset-left, 0px));
        }

        /* Pull to refresh */
        .ptr-anchor {
            position: relative;
            height: 0;
            z-index: 5;
        }
        .ptr-indicator {
            position: absolute;
            left: 50%;
            top: 10px;
            width: 34px;
            height: 34px;
            margin-left: -17px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent-color);
            background: #1f2937;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
            transform: translateY(-60px);
            opacity: 0;
        }
        .ptr-indicator svg {
            transition: transform 0.2s ease;
        }
        .ptr-indicator.is-armed svg {
            transform: rotate(180deg);
        }
        .ptr-indicator.is-refreshing svg {
            animation: ptr-spin 0.8s linear infinite;
        }
        @keyframes ptr-spin {
            to { transform: rotate(360deg); }
        }

        /* Pill shown when new articles arrive while scrolled down */
        .new-articles-pill {
            position: fixed;
            left: 50%;
            top: calc(var(--header-height, 100px) + 10px);
            z-index: 20;
            transform: translate(-50%, -12px);
            padding: 7px 14px;
            border-radius: 999px;
            border: none;
            background: var(--accent-color);
            color: #0b0f19;
            font: 600 0.8rem var(--font-family);
            box-shadow: 0 6px 20px rgba(56, 189, 248, 0.35);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .new-articles-pill.is-visible {
            opacity: 1;
            pointer-events: auto;
            transform: translate(-50%, 0);
        }

        /* Feed item container cards */
        .feed-item {
            position: relative;
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
            transition: border-color 0.2s, box-shadow 0.2s, opacity 0.35s ease, filter 0.35s ease, transform 0.18s ease, background-color 0.35s ease;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }

        /* Cards rise in one after another on a fresh launch */
        html:not(.is-back-nav):not(.no-stagger) .feed-item {
            animation: card-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
            animation-delay: calc(min(var(--i, 0), 12) * 40ms + 60ms);
        }
        html.show-splash .feed-item {
            animation-play-state: paused;
        }
        @keyframes card-in {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
        }

        .feed-item.is-new {
            animation: card-new 1.6s ease-out;
        }
        @keyframes card-new {
            0%, 30% { border-color: rgba(56, 189, 248, 0.7); box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 0 18px rgba(56, 189, 248, 0.2); }
        }

        /* Native-feeling press feedback on touch screens */
        @media (hover: none) {
            .feed-item:active:not(.swiping-left):not(.swiping-right) {
                transform: scale(0.98);
            }
        }

        .feed-item:last-child {
            margin-bottom: 0;
        }

        /* Swipe background states */
        .feed-item.swiping-right {
            background: linear-gradient(to right, #059669 0%, var(--card-bg) 60%);
        }
        .feed-item.swiping-left {
            background: linear-gradient(to left, #2563eb 0%, var(--card-bg) 60%);
        }

        /* Pseudo-elements for swipe icons/text */
        .feed-item::before {
            content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 6 7 17l-5-5'/><path d='m22 10-7.5 7.5L13 16'/></svg>");
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0;
            transition: opacity 0.15s ease;
            z-index: 1;
            pointer-events: none;
        }

        .feed-item::after {
            content: "● Ungelesen";
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: #ffffff;
            font-size: 0.8rem;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.15s ease;
            z-index: 1;
            pointer-events: none;
        }

        .feed-item.swiping-right::before {
            opacity: 1;
        }

        .feed-item.swiping-left::after {
            opacity: 1;
        }

        /* Styling for already read articles (dimmed state) */
        .feed-item.is-read:not(.swiping-left):not(.swiping-right) {
            opacity: 0.45;
            filter: grayscale(40%);
            border-color: rgba(255, 255, 255, 0.03);
            background-color: rgba(17, 24, 39, 0.5);
        }

        @media (hover: hover) {
            .feed-item:hover {
                transform: translateY(-1px);
                border-color: rgba(56, 189, 248, 0.4);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                opacity: 1; /* Restore opacity on hover for readability */
                filter: none;
            }

            .feed-item:hover .feed-link {
                background-color: var(--card-hover);
            }

            .feed-item:hover .feed-item-title {
                color: var(--accent-color);
            }

            .feed-item:hover .feed-thumbnail {
                transform: scale(1.05);
            }
        }

        .feed-link {
            text-decoration: none;
            color: inherit;
            display: block;
            padding: 12px;
            position: relative;
            z-index: 2;
            background-color: var(--card-bg);
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
        }

        .feed-item.swiping-left .feed-link,
        .feed-item.swiping-right .feed-link {
            background-color: var(--card-bg) !important;
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
            line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
        }

        .feed-item-description.is-expanded {
            display: block;
            -webkit-line-clamp: none;
            overflow: visible;
            text-overflow: clip;
        }

        .more-link-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 6px;
        }

        .more-link {
            display: inline-flex;
            align-items: center;
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--accent-color);
            cursor: pointer;
            text-decoration: underline;
            text-underline-offset: 2px;
            transition: color 0.15s ease, opacity 0.15s ease;
        }

        .more-link:hover {
            color: #7dd3fc;
            opacity: 0.9;
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
            -webkit-user-drag: none;
            pointer-events: none;
        }

        footer {
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
            padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
            text-align: center;
            font-size: 0.68rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body data-generated="${Date.now()}">
    ${renderPwaBodyStart()}
    <header>
        <div class="header-top">
            <div class="header-title-container">
                <h1>${feedName === "leadership" ? "Leadership in Tech" : `TLDR ${formattedFeedName}`}</h1>
                <p>Aktuelle Artikel aus dem ${feedName === "leadership" ? "Leadership in Tech" : "TLDR"} Feed</p>
            </div>
            <div class="header-actions">
                <button id="mark-all-read-btn" class="header-action-btn" title="Alle als gelesen markieren" onclick="markAllAsReadCurrentFeed()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 7 17l-5-5"/>
                        <path d="m22 10-7.5 7.5L13 16"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="feed-tabs-container">
            <nav class="feed-tabs">
                ${tabsHtml}
            </nav>
        </div>
    </header>
    <div class="ptr-anchor">
        <div class="ptr-indicator" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14"/>
                <path d="m19 12-7 7-7-7"/>
            </svg>
        </div>
    </div>
    <button class="new-articles-pill" type="button">Neue Artikel</button>
    <main class="feed-list">
        ${sortedPosts
          .map((post, index) => {
            const read = isRead(post.link);
            const readerHref = `/reader?url=${encodeURIComponent(post.link)}`;
            return `        <article class="feed-item ${read ? "is-read" : ""}" style="--i: ${index}" data-link="${escapeHtmlAttr(post.link)}">
            <a href="${escapeHtmlAttr(readerHref)}" onclick="markAsRead(this.closest('.feed-item').dataset.link, this)" target="_blank" class="feed-link" rel="noopener noreferrer">
                <div class="feed-content-wrapper">
                    <div class="feed-text-block">
                        <h2 class="feed-item-title">${escapeHtml(post.title)}</h2>
                        <div class="feed-item-meta">
                            <time datetime="${new Date(post.date).toISOString()}">${escapeHtml(formatDate(post.date))}</time>
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
                <div class="more-link-container">
                    <span class="more-link" role="button" tabindex="0">mehr</span>
                </div>
            </a>
        </article>`;
          })
          .join("\n")}
    </main>
    <footer id="feed-updated">
        Stand: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
    </footer>
    <script>
        const feedList = document.querySelector('main.feed-list');
        const SCROLL_KEY = 'tldr-scroll:' + location.pathname + location.search;

        // Preserve query parameters (like password) across tab navigations and reader links
        function prepareLinks(scope) {
            scope.querySelectorAll('.tab-btn, .feed-link').forEach(link => {
                const url = new URL(link.href, window.location.origin);
                const currentParams = new URLSearchParams(window.location.search);
                currentParams.forEach((value, key) => {
                    if (!url.searchParams.has(key)) {
                        url.searchParams.set(key, value);
                    }
                });
                link.href = url.pathname + url.search;
                // Installed as an app, articles open in place instead of leaving to the browser
                if (window.tldrApp.standalone && link.classList.contains('feed-link')) {
                    link.removeAttribute('target');
                }
            });
        }
        prepareLinks(document);

        // Scroll the active tab into view horizontally
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }

        // Read status is also kept in localStorage so it survives reloads even when
        // the server can't persist it (ephemeral serverless filesystem, CDN-cached HTML)
        const READ_STATUS_KEY = 'tldr-read-status';
        const MAX_READ_STATUS_ENTRIES = 1000;

        function loadLocalReadStatus() {
            try {
                const data = JSON.parse(localStorage.getItem(READ_STATUS_KEY) || '{}');
                return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
            } catch (err) {
                return {};
            }
        }

        function saveLocalReadStatus(links, read) {
            try {
                const status = loadLocalReadStatus();
                links.forEach(link => {
                    // Re-insert so the most recent changes are kept when pruning
                    delete status[link];
                    status[link] = read;
                });
                const keys = Object.keys(status);
                keys.slice(0, Math.max(0, keys.length - MAX_READ_STATUS_ENTRIES)).forEach(key => delete status[key]);
                localStorage.setItem(READ_STATUS_KEY, JSON.stringify(status));
            } catch (err) {
                console.error('Failed to store read status locally:', err);
            }
        }

        function applyLocalReadStatus() {
            const status = loadLocalReadStatus();
            document.querySelectorAll('.feed-item[data-link]').forEach(item => {
                const read = status[item.dataset.link];
                if (read === true) {
                    item.classList.add('is-read');
                } else if (read === false) {
                    item.classList.remove('is-read');
                }
            });
        }

        function postReadStatus(path, param, value) {
            // Extract the password query parameter from current URL to propagate if used
            const urlParams = new URLSearchParams(window.location.search);
            const password = urlParams.get('password');

            let targetUrl = path + '?' + param + '=' + encodeURIComponent(value);
            if (password) {
                targetUrl += '&password=' + encodeURIComponent(password);
            }

            return fetch(targetUrl, {
                method: 'POST',
                keepalive: true
            });
        }

        function markAsRead(link, element) {
            // Immediately mark it as read visually
            const card = element.closest('.feed-item');
            if (card) {
                card.classList.add('is-read');
            }
            saveLocalReadStatus([link], true);

            // Post the read status back to the server
            postReadStatus('/mark-read', 'link', link)
                .catch(err => console.error('Failed to mark read status:', err));
        }

        function markAllAsReadCurrentFeed() {
            const feedItems = document.querySelectorAll('.feed-item:not(.is-read)');
            if (feedItems.length === 0) return;

            const links = [];
            feedItems.forEach(item => {
                item.classList.add('is-read');
                if (item.dataset.link) {
                    links.push(item.dataset.link);
                }
            });

            if (links.length === 0) return;

            saveLocalReadStatus(links, true);
            postReadStatus('/mark-all-read', 'links', links.join(','))
                .catch(err => console.error('Failed to mark all as read:', err));
        }

        function markAsReadFromSwipe(item) {
            if (item.classList.contains('is-read')) return;
            const linkElement = item.querySelector('.feed-link');
            if (linkElement && item.dataset.link) {
                markAsRead(item.dataset.link, linkElement);
            }
        }

        function markAsUnreadFromSwipe(item) {
            if (!item.classList.contains('is-read')) return;
            const link = item.dataset.link;
            if (!link) return;

            item.classList.remove('is-read');
            saveLocalReadStatus([link], false);

            postReadStatus('/mark-unread', 'link', link)
                .catch(err => console.error('Failed to mark unread status:', err));
        }

        // Initialize mouse drag scrolling for tab bar
        function initTabScrolling() {
            const container = document.querySelector('.feed-tabs-container');
            if (!container) return;

            let isDown = false;
            let startX = 0;
            let scrollLeft = 0;
            let isDragging = false;

            container.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isDown = true;
                isDragging = false;
                container.classList.add('is-dragging');
                startX = e.pageX - container.offsetLeft;
                scrollLeft = container.scrollLeft;
            });

            window.addEventListener('mouseup', () => {
                if (!isDown) return;
                isDown = false;
                container.classList.remove('is-dragging');
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX);
                if (Math.abs(walk) > 5) {
                    isDragging = true;
                }
                container.scrollLeft = scrollLeft - walk;
            });

            const tabLinks = container.querySelectorAll('.tab-btn');
            tabLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        isDragging = false;
                    }
                });
            });

            container.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    container.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        // Initialize touch and mouse swipe gestures on all feed items
        function initSwipeGestures(feedItems) {
            feedItems.forEach(item => {
                const link = item.querySelector('.feed-link');
                if (!link) return;
                
                let startX = 0;
                let startY = 0;
                let currentX = 0;
                let isSwiping = false;
                let swipeDirection = null;
                const threshold = 80;
                let preventClick = false;
                let crossedThreshold = false;

                item.addEventListener('dragstart', (e) => e.preventDefault());

                link.addEventListener('click', (e) => {
                    if (preventClick) {
                        e.preventDefault();
                        e.stopPropagation();
                        preventClick = false;
                    }
                }, true);
                
                item.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    isSwiping = false;
                    swipeDirection = null;
                    currentX = 0;
                    crossedThreshold = false;
                    
                    link.style.transition = 'none';
                }, { passive: true });
                
                item.addEventListener('touchmove', (e) => {
                    const touchX = e.touches[0].clientX;
                    const touchY = e.touches[0].clientY;
                    
                    const diffX = touchX - startX;
                    const diffY = touchY - startY;
                    
                    if (!isSwiping) {
                        if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                            isSwiping = true;
                        }
                    }
                    
                    if (isSwiping) {
                        e.preventDefault();
                        currentX = diffX;
                        
                        const maxSwipe = 120;
                        let constrainedX = diffX;
                        if (diffX > maxSwipe) constrainedX = maxSwipe;
                        if (diffX < -maxSwipe) constrainedX = -maxSwipe;
                        
                        link.style.transform = 'translateX(' + constrainedX + 'px)';

                        const beyondThreshold = Math.abs(diffX) > threshold;
                        if (beyondThreshold !== crossedThreshold) {
                            crossedThreshold = beyondThreshold;
                            if (beyondThreshold) window.tldrApp.haptic();
                        }
                        
                        if (constrainedX > 0) {
                            if (swipeDirection !== 'right') {
                                item.classList.remove('swiping-left');
                                item.classList.add('swiping-right');
                                swipeDirection = 'right';
                            }
                        } else if (constrainedX < 0) {
                            if (swipeDirection !== 'left') {
                                item.classList.remove('swiping-right');
                                item.classList.add('swiping-left');
                                swipeDirection = 'left';
                            }
                        }
                    }
                }, { passive: false });
                
                item.addEventListener('touchend', () => {
                    if (isSwiping) {
                        link.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                        link.style.transform = 'translateX(0px)';
                        
                        if (currentX > threshold) {
                            markAsReadFromSwipe(item);
                        } else if (currentX < -threshold) {
                            markAsUnreadFromSwipe(item);
                        }
                    }
                    
                    setTimeout(() => {
                        item.classList.remove('swiping-left', 'swiping-right');
                    }, 200);
                }, { passive: true });

                // Mouse Events
                let isMouseDown = false;

                item.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    if (e.target.closest('.more-link')) return;

                    isMouseDown = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    isSwiping = false;
                    swipeDirection = null;
                    currentX = 0;

                    link.style.transition = 'none';
                });

                window.addEventListener('mousemove', (e) => {
                    if (!isMouseDown) return;

                    const diffX = e.clientX - startX;
                    const diffY = e.clientY - startY;

                    if (!isSwiping) {
                        if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                            isSwiping = true;
                            preventClick = true;
                        }
                    }

                    if (isSwiping) {
                        e.preventDefault();
                        currentX = diffX;

                        const maxSwipe = 120;
                        let constrainedX = diffX;
                        if (diffX > maxSwipe) constrainedX = maxSwipe;
                        if (diffX < -maxSwipe) constrainedX = -maxSwipe;

                        link.style.transform = 'translateX(' + constrainedX + 'px)';

                        if (constrainedX > 0) {
                            if (swipeDirection !== 'right') {
                                item.classList.remove('swiping-left');
                                item.classList.add('swiping-right');
                                swipeDirection = 'right';
                            }
                        } else if (constrainedX < 0) {
                            if (swipeDirection !== 'left') {
                                item.classList.remove('swiping-right');
                                item.classList.add('swiping-left');
                                swipeDirection = 'left';
                            }
                        }
                    }
                });

                window.addEventListener('mouseup', () => {
                    if (!isMouseDown) return;
                    isMouseDown = false;

                    if (isSwiping) {
                        link.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                        link.style.transform = 'translateX(0px)';

                        if (currentX > threshold) {
                            markAsReadFromSwipe(item);
                        } else if (currentX < -threshold) {
                            markAsUnreadFromSwipe(item);
                        }
                    }

                    setTimeout(() => {
                        item.classList.remove('swiping-left', 'swiping-right');
                    }, 200);
                });
            });
        }

        // Initialize click to toggle description expansion via "mehr" link
        function initMoreToggle(scope) {
            const moreLinks = scope.querySelectorAll('.more-link');
            moreLinks.forEach(linkBtn => {
                const handleToggle = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const card = linkBtn.closest('.feed-item');
                    if (!card) return;
                    
                    const desc = card.querySelector('.feed-item-description');
                    const isExpanded = desc ? desc.classList.toggle('is-expanded') : false;
                    
                    linkBtn.textContent = isExpanded ? 'weniger' : 'mehr';
                };

                linkBtn.addEventListener('click', handleToggle);
                linkBtn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        handleToggle(e);
                    }
                });
            });
        }

        // Navigations inside the app get a matching view transition
        function initNavigation() {
            const tabs = Array.from(document.querySelectorAll('.tab-btn'));
            const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));

            tabs.forEach((tab, index) => {
                tab.addEventListener('click', (e) => {
                    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || index === activeIndex) return;
                    window.tldrApp.clearSharedNames();
                    window.tldrApp.nameShared(feedList, 'feed-list');
                    window.tldrApp.setTransition({ type: index > activeIndex ? 'tab-next' : 'tab-prev' });
                    window.tldrApp.startNavigation();
                });
            });

            // Delegated so refreshed items are covered as well
            feedList.addEventListener('click', (e) => {
                const link = e.target.closest('.feed-link');
                if (!link || e.defaultPrevented || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
                const card = link.closest('.feed-item');
                window.tldrApp.clearSharedNames();
                window.tldrApp.nameShared(card.querySelector('.feed-item-title'), 'article-title');
                window.tldrApp.setTransition({ type: 'push', link: card.dataset.link });
                saveScrollPosition();
                window.tldrApp.startNavigation();
            });
        }

        function saveScrollPosition() {
            try {
                sessionStorage.setItem(SCROLL_KEY, String(feedList.scrollTop));
            } catch (err) {}
        }

        // Coming back from an article: restore the list position and morph the title back into its card
        window.tldrApp.whenRevealed((transition, hasViewTransition) => {
            window.tldrApp.clearSharedNames();
            if (!transition || (transition.type !== 'pop' && transition.type !== 'swipe-back')) return;
            try {
                const saved = sessionStorage.getItem(SCROLL_KEY);
                if (saved !== null) feedList.scrollTop = Number(saved);
            } catch (err) {}
            if (hasViewTransition && transition.type === 'pop' && transition.link) {
                const card = Array.from(document.querySelectorAll('.feed-item'))
                    .find(item => item.dataset.link === transition.link);
                if (card) window.tldrApp.nameShared(card.querySelector('.feed-item-title'), 'article-title');
            }
        });
        window.addEventListener('pagehide', saveScrollPosition);

        function updateHeaderHeight() {
            const header = document.querySelector('header');
            if (header) document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
        }

        // Fetch a fresh copy of this feed (bypassing the service worker cache) and merge it in place
        let pendingFeed = null;
        let refreshing = null;
        const STALE_AFTER_MS = 5 * 60 * 1000;

        function fetchFreshFeed() {
            return fetch(location.href, {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { 'X-Refresh': '1' }
            }).then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            }).then(html => new DOMParser().parseFromString(html, 'text/html'));
        }

        function updateFreshness(doc) {
            const freshFooter = doc.getElementById('feed-updated');
            const footer = document.getElementById('feed-updated');
            if (freshFooter && footer) footer.innerHTML = freshFooter.innerHTML;
            document.body.dataset.generated = doc.body.dataset.generated || String(Date.now());
        }

        function applyFeed(doc, addedLinks) {
            updateFreshness(doc);
            const freshList = doc.querySelector('main.feed-list');
            if (!freshList) return;

            const swap = () => {
                document.documentElement.classList.add('no-stagger');
                feedList.innerHTML = freshList.innerHTML;
                const items = feedList.querySelectorAll('.feed-item');
                items.forEach(item => {
                    if (addedLinks.includes(item.dataset.link)) item.classList.add('is-new');
                });
                prepareLinks(feedList);
                applyLocalReadStatus();
                initSwipeGestures(items);
                initMoreToggle(feedList);
            };
            if (document.startViewTransition) {
                window.tldrApp.nameShared(feedList, 'feed-list');
                document.startViewTransition(swap).finished.finally(() => window.tldrApp.clearSharedNames());
            } else {
                swap();
            }
        }

        function refreshFeed(options) {
            if (refreshing) return refreshing;
            const silent = options && options.silent;
            refreshing = fetchFreshFeed().then(doc => {
                const currentLinks = Array.from(feedList.querySelectorAll('.feed-item')).map(item => item.dataset.link);
                const freshLinks = Array.from(doc.querySelectorAll('main.feed-list .feed-item')).map(item => item.dataset.link);
                const addedLinks = freshLinks.filter(link => !currentLinks.includes(link));
                const changed = freshLinks.join(' ') !== currentLinks.join(' ');

                if (!changed) {
                    updateFreshness(doc);
                    if (!silent) window.tldrApp.toast('Alles aktuell');
                    return;
                }
                // Don't shuffle the list under someone who is reading further down
                if (silent && feedList.scrollTop > 40) {
                    pendingFeed = { doc, addedLinks };
                    const pill = document.querySelector('.new-articles-pill');
                    pill.textContent = addedLinks.length > 0
                        ? '↑ ' + addedLinks.length + (addedLinks.length === 1 ? ' neuer Artikel' : ' neue Artikel')
                        : '↑ Feed aktualisiert';
                    pill.classList.add('is-visible');
                    return;
                }
                applyFeed(doc, addedLinks);
                if (addedLinks.length > 0) {
                    window.tldrApp.toast(addedLinks.length + (addedLinks.length === 1 ? ' neuer Artikel' : ' neue Artikel'));
                } else if (!silent) {
                    window.tldrApp.toast('Feed aktualisiert');
                }
            }).catch(err => {
                console.error('Failed to refresh feed:', err);
                if (!silent) window.tldrApp.toast(navigator.onLine ? 'Aktualisierung fehlgeschlagen' : 'Du bist offline');
            }).finally(() => {
                refreshing = null;
            });
            return refreshing;
        }

        function initNewArticlesPill() {
            const pill = document.querySelector('.new-articles-pill');
            pill.addEventListener('click', () => {
                pill.classList.remove('is-visible');
                feedList.scrollTo({ top: 0, behavior: 'smooth' });
                if (pendingFeed) {
                    applyFeed(pendingFeed.doc, pendingFeed.addedLinks);
                    pendingFeed = null;
                }
            });
        }

        function refreshIfStale() {
            const generated = Number(document.body.dataset.generated || 0);
            if (document.visibilityState === 'visible' && Date.now() - generated > STALE_AFTER_MS) {
                refreshFeed({ silent: true });
            }
        }

        // Pull down at the top of the list to refresh, like a native app
        function initPullToRefresh() {
            const indicator = document.querySelector('.ptr-indicator');
            const TRIGGER = 70;
            const MAX = 110;
            let startX = 0;
            let startY = 0;
            let tracking = false;
            let pulling = false;
            let distance = 0;
            let armed = false;

            const render = (value, animate) => {
                const transition = animate ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s' : 'none';
                feedList.style.transition = transition;
                indicator.style.transition = transition;
                feedList.style.transform = value > 0 ? 'translateY(' + value + 'px)' : '';
                indicator.style.transform = 'translateY(' + (value - 60) + 'px) rotate(' + value * 2 + 'deg)';
                indicator.style.opacity = String(Math.min(1, value / TRIGGER));
            };

            feedList.addEventListener('touchstart', (e) => {
                if (refreshing || feedList.scrollTop > 0 || e.touches.length !== 1) return;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                tracking = true;
                pulling = false;
                distance = 0;
                armed = false;
            }, { passive: true });

            feedList.addEventListener('touchmove', (e) => {
                if (!tracking) return;
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                if (!pulling) {
                    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
                    if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || feedList.scrollTop > 0) {
                        tracking = false;
                        return;
                    }
                    pulling = true;
                }
                e.preventDefault();
                // Rubber band resistance
                distance = Math.min(MAX, dy * 0.5);
                if ((distance >= TRIGGER) !== armed) {
                    armed = distance >= TRIGGER;
                    indicator.classList.toggle('is-armed', armed);
                    if (armed) window.tldrApp.haptic();
                }
                render(distance, false);
            }, { passive: false });

            const end = () => {
                if (!tracking) return;
                tracking = false;
                if (!pulling) return;
                pulling = false;
                indicator.classList.remove('is-armed');
                if (!armed) {
                    render(0, true);
                    return;
                }
                indicator.classList.add('is-refreshing');
                render(56, true);
                const minimumSpin = new Promise(resolve => setTimeout(resolve, 600));
                Promise.all([refreshFeed({ silent: false }), minimumSpin]).then(() => {
                    indicator.classList.remove('is-refreshing');
                    render(0, true);
                });
            };
            feedList.addEventListener('touchend', end, { passive: true });
            feedList.addEventListener('touchcancel', end, { passive: true });
        }

        // Run gesture and toggle initialization when DOM is ready
        function initAll() {
            applyLocalReadStatus();
            initTabScrolling();
            initSwipeGestures(document.querySelectorAll('.feed-item'));
            initMoreToggle(document);
            initNavigation();
            initPullToRefresh();
            initNewArticlesPill();
            updateHeaderHeight();
            window.addEventListener('resize', updateHeaderHeight);
            document.addEventListener('visibilitychange', refreshIfStale);
            window.addEventListener('pageshow', (e) => {
                if (e.persisted) {
                    applyLocalReadStatus();
                    refreshIfStale();
                }
            });
            setTimeout(refreshIfStale, 1200);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }
    </script>
    ${PWA_BODY_END}
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
