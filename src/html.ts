import { writeFile } from "fs/promises";

import { FEEDS } from "./config";
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
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
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

  const formattedFeedName =
    feedName.charAt(0).toUpperCase() + feedName.slice(1);

  // Generate tab HTML links
  const tabsHtml = FEEDS.map((f) => {
    const active = f === feedName;
    let displayName = f.charAt(0).toUpperCase() + f.slice(1);
    if (f === "ai") displayName = "AI";
    if (f === "devops") displayName = "DevOps";
    return `<a href="/${f}.html" class="tab-btn ${active ? "active" : ""}">${displayName}</a>`;
  }).join("\n                ");

  // Generate responsive, beautiful HTML optimized for Vivaldi sidebar and panels
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="TLDR ${formattedFeedName} Feed Reader">
    <title>TLDR ${formattedFeedName}</title>
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
            padding: 12px 16px 8px 16px;
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

        .header-action-btn:hover {
            color: var(--accent-color);
            background: var(--accent-glow);
            border-color: rgba(56, 189, 248, 0.3);
            transform: scale(1.05);
        }

        .header-action-btn:active {
            transform: scale(0.95);
        }

        /* Feed tabs navigation */
        .feed-tabs-container {
            width: 100%;
            overflow-x: auto;
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
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
        }

        .tab-btn:hover {
            color: var(--text-primary);
            background-color: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .tab-btn.active {
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
            padding: 12px;
        }

        /* Feed item container cards */
        .feed-item {
            position: relative;
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
            transition: border-color 0.2s, box-shadow 0.2s;
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

        .feed-link {
            text-decoration: none;
            color: inherit;
            display: block;
            padding: 12px;
            position: relative;
            z-index: 2;
            background-color: var(--card-bg);
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
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
            cursor: pointer;
        }

        .feed-item-description.is-expanded {
            display: block;
            -webkit-line-clamp: none;
            overflow: visible;
            text-overflow: clip;
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
        <div class="header-top">
            <div class="header-title-container">
                <h1>TLDR ${formattedFeedName}</h1>
                <p>Aktuelle Artikel aus dem TLDR Feed</p>
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
    <main>
        ${sortedPosts
          .map((post) => {
            const read = isRead(post.link);
            return `        <article class="feed-item ${read ? "is-read" : ""}">
            <a href="${escapeHtmlAttr(post.link)}" onclick="markAsRead('${escapeHtmlAttr(post.link)}', this)" target="_blank" class="feed-link" rel="noopener noreferrer">
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
            </a>
        </article>`;
          })
          .join("\n")}
    </main>
    <footer>
        Stand: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
    </footer>
    <script>
        // Preserve query parameters (like password) across tab navigations
        document.querySelectorAll('.tab-btn').forEach(tab => {
            const url = new URL(tab.href, window.location.origin);
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.forEach((value, key) => {
                url.searchParams.set(key, value);
            });
            tab.href = url.pathname + url.search;
        });

        // Scroll the active tab into view horizontally
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }

        function markAsRead(link, element) {
            // Immediately mark it as read visually
            const card = element.closest('.feed-item');
            if (card) {
                card.classList.add('is-read');
            }
            
            // Extract the password query parameter from current URL to propagate if used
            const urlParams = new URLSearchParams(window.location.search);
            const password = urlParams.get('password');
            
            let targetUrl = '/mark-read?link=' + encodeURIComponent(link);
            if (password) {
                targetUrl += '&password=' + encodeURIComponent(password);
            }
            
            // Post the read status back to the server
            fetch(targetUrl, {
                method: 'POST',
                keepalive: true
            }).catch(err => console.error('Failed to mark read status:', err));
        }

        function markAllAsReadCurrentFeed() {
            const feedItems = document.querySelectorAll('.feed-item:not(.is-read)');
            if (feedItems.length === 0) return;

            const links = [];
            feedItems.forEach(item => {
                item.classList.add('is-read');
                const linkElement = item.querySelector('.feed-link');
                if (linkElement) {
                    const href = linkElement.getAttribute('href');
                    if (href) {
                        links.push(href);
                    }
                }
            });

            if (links.length === 0) return;

            // Extract the password query parameter from current URL to propagate if used
            const urlParams = new URLSearchParams(window.location.search);
            const password = urlParams.get('password');
            
            let targetUrl = '/mark-all-read?links=' + encodeURIComponent(links.join(','));
            if (password) {
                targetUrl += '&password=' + encodeURIComponent(password);
            }
            
            fetch(targetUrl, {
                method: 'POST',
                keepalive: true
            }).catch(err => console.error('Failed to mark all as read:', err));
        }

        function markAsReadFromSwipe(item) {
            if (item.classList.contains('is-read')) return;
            const linkElement = item.querySelector('.feed-link');
            if (linkElement) {
                const link = linkElement.getAttribute('href');
                if (link) {
                    markAsRead(link, linkElement);
                }
            }
        }

        function markAsUnreadFromSwipe(item) {
            if (!item.classList.contains('is-read')) return;
            const linkElement = item.querySelector('.feed-link');
            if (linkElement) {
                const link = linkElement.getAttribute('href');
                if (link) {
                    item.classList.remove('is-read');
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const password = urlParams.get('password');
                    
                    let targetUrl = '/mark-unread?link=' + encodeURIComponent(link);
                    if (password) {
                        targetUrl += '&password=' + encodeURIComponent(password);
                    }
                    
                    fetch(targetUrl, {
                        method: 'POST',
                        keepalive: true
                    }).catch(err => console.error('Failed to mark unread status:', err));
                }
            }
        }

        // Initialize touch swipe on all feed items
        function initSwipeGestures() {
            const feedItems = document.querySelectorAll('.feed-item');
            
            feedItems.forEach(item => {
                const link = item.querySelector('.feed-link');
                if (!link) return;
                
                let startX = 0;
                let startY = 0;
                let currentX = 0;
                let isSwiping = false;
                let swipeDirection = null;
                const threshold = 80;
                
                item.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    isSwiping = false;
                    swipeDirection = null;
                    
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
            });
        }

        // Initialize click to toggle description expansion
        function initDescriptionToggle() {
            const descriptions = document.querySelectorAll('.feed-item-description');
            descriptions.forEach(desc => {
                desc.addEventListener('click', (e) => {
                    // Prevent opening the link when clicking the description text
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const card = desc.closest('.feed-item');
                    const linkElement = card.querySelector('.feed-link');
                    const link = linkElement.getAttribute('href');
                    
                    // Toggle the expanded class
                    const isExpanded = desc.classList.toggle('is-expanded');
                    
                    // Immediately mark as read when expanding
                    if (isExpanded) {
                        markAsRead(link, linkElement);
                    }
                });
            });
        }

        // Run gesture and toggle initialization when DOM is ready
        function initAll() {
            initSwipeGestures();
            initDescriptionToggle();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }
    </script>
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
