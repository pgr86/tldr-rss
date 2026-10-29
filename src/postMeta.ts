// Small helpers that turn raw TLDR posts into what the list shows in its meta row

const READING_TIME_SUFFIX = /\s*\((\d+)\s+minute read\)\s*$/i;

/** Moves a trailing "(17 minute read)" out of the title into a separate number */
export const splitReadingTime = (
  title: string,
): { title: string; minutes?: number } => {
  const match = title.match(READING_TIME_SUFFIX);
  if (!match) {
    return { title: title.trim() };
  }

  return {
    title: title.slice(0, match.index).trim(),
    minutes: parseInt(match[1], 10),
  };
};

/** Hostname of an article link without a leading "www.", or "" for invalid links */
export const sourceHost = (link: string): string => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Short FNV-1a hash of an article link. The feed page embeds these for the unread
 * counts on its tabs; the browser hashes its read-status keys the same way (src/html.ts).
 */
export const linkHash = (link: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < link.length; i++) {
    hash ^= link.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};
