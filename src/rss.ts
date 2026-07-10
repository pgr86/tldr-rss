import { writeFile } from "fs/promises";
import xml from "xml";

import { logger } from "./util";

type Post = {
  title: string;
  date: string;
  content: string;
  link: string;
  image?: string;
};

function buildFeed(posts: Post[], direct = false) {
  const sortedPosts = posts.sort(
    (first, second) =>
      new Date(second.date).getTime() - new Date(first.date).getTime(),
  );

  const feedItems = [];

  feedItems.push(
    ...sortedPosts.map((post) => {
      const itemElements: any[] = [
        { title: post.title },
        { link: post.link },
        {
          pubDate: new Date(post.date as string).toUTCString(),
        },
        {
          guid: [{ _attr: { isPermaLink: true } }, post.link],
        },
      ];

      if (!direct) {
        itemElements.push(
          {
            description: {
              _cdata: buildItemHtml(post),
            },
          },
          {
            "content:encoded": {
              _cdata: buildItemHtml(post),
            },
          },
        );
      }

      if (post.image) {
        itemElements.push(
          ...[
            {
              "media:content": {
                _attr: {
                  url: post.image,
                  medium: "image",
                },
              },
            },
            {
              "media:thumbnail": {
                _attr: {
                  url: post.image,
                },
              },
            },
          ],
        );
      }

      return {
        item: itemElements,
      };
    }),
  );

  return feedItems;
}

export const renderRssFeed = (
  feedName: string,
  posts: Post[],
  siteUrl = "https://bullrich.dev/tldr-rss",
  direct = false,
): string => {
  if (posts.length === 0) {
    throw new Error(`No posts found for ${feedName}`);
  }

  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const feedObject = {
    rss: [
      {
        _attr: {
          version: "2.0",
          "xmlns:atom": "http://www.w3.org/2005/Atom",
          "xmlns:content": "http://purl.org/rss/1.0/modules/content/",
          "xmlns:media": "http://search.yahoo.com/mrss/",
        },
      },
      {
        channel: [
          {
            "atom:link": {
              _attr: {
                href: `${normalizedSiteUrl}/${feedName}.rss`,
                rel: "self",
                type: "application/rss+xml",
              },
            },
          },
          {
            title: feedName.endsWith("_direct")
              ? `TLDR ${feedName.replace("_direct", "").toUpperCase()} Direct Feed`
              : `TLDR ${feedName.toUpperCase()} Feed`,
          },
          {
            link: `${normalizedSiteUrl}/`,
          },
          {
            description: feedName.endsWith("_direct")
              ? "TLDR RSS Feed (Direct Links)"
              : "TLDR RSS Feed",
          },
          { language: "en-US" },
          {
            image: [
              { url: "https://tldr.tech/tldrsquare.png" },
              { title: "TLDR RSS Feed" },
              { link: "https://tldr.tech" },
            ],
          },
          ...buildFeed(posts, direct),
        ],
      },
    ],
  };

  return '<?xml version="1.0" encoding="UTF-8"?>' + xml(feedObject);
};

function buildItemHtml(post: Post): string {
  const image = post.image
    ? `<p><img src="${escapeHtmlAttr(post.image)}" alt="${escapeHtmlAttr(
        post.title,
      )}" /></p>`
    : "";

  return `${image}<p>${escapeHtml(post.content)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

export const writeRssFeed = async (
  feedName: string,
  posts: Post[],
  direct = false,
): Promise<void> => {
  logger.info(`Creating feed for ${feedName} 📚`);

  const feed = renderRssFeed(feedName, posts, undefined, direct);

  await writeFile(`./site/${feedName}.rss`, feed, "utf8");
};
