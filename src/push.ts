import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import webpush from "web-push";

import { FEEDS } from "./config";
import { fetchFeedNews, type NewsWithDate } from "./feed";
import { getDisplayName } from "./html";
import { isRead } from "./readStatus";
import { logger } from "./util";

// Web push "drip": new articles are queued as they appear and sent one at a time,
// spaced out over the day, instead of a burst whenever a newsletter drops.

const CACHE_DIR = "./.cache";
const PUSH_STATE_FILE = path.join(CACHE_DIR, "push_state.json");
const MAX_SEEN_ENTRIES = 3000;
const TICK_MS = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type QueuedInsight = {
  link: string;
  title: string;
  content: string;
  image?: string;
  feed: string;
  date: string;
  queuedAt: number;
};

type PushState = {
  vapid?: { publicKey: string; privateKey: string };
  subscriptions: PushSubscriptionJSON[];
  seen: string[];
  queue: QueuedInsight[];
  initialized: boolean;
  nextSendAt: number;
  lastSentByFeed: Record<string, number>;
};

export type PushSettings = {
  intervalMinutes: number;
  maxAgeHours: number;
  quietHours: { start: number; end: number } | null;
  timeZone: string;
};

const readNumber = (value: string | undefined, fallback: number): number => {
  const parsed = parseFloat(value || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// "22-7" means no notifications from 22:00 until 06:59; "off" disables quiet hours
export const parseQuietHours = (
  value: string | undefined,
): { start: number; end: number } | null => {
  const match = (value ?? "22-7").trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  if (start > 23 || end > 23 || start === end) return null;
  return { start, end };
};

export const getPushSettings = (): PushSettings => {
  return {
    intervalMinutes: readNumber(process.env.PUSH_INTERVAL_MINUTES, 45),
    maxAgeHours: readNumber(process.env.PUSH_MAX_AGE_HOURS, 36),
    quietHours: parseQuietHours(process.env.PUSH_QUIET_HOURS),
    timeZone: process.env.PUSH_TIMEZONE || "Europe/Berlin",
  };
};

export const isQuietTime = (
  now: Date,
  quietHours: PushSettings["quietHours"],
  timeZone: string,
): boolean => {
  if (!quietHours) return false;
  const hour =
    parseInt(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(now),
      10,
    ) % 24;
  const { start, end } = quietHours;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
};

let state: PushState | null = null;
let schedulerRunning = false;

const loadState = (): PushState => {
  if (state) return state;
  const empty: PushState = {
    subscriptions: [],
    seen: [],
    queue: [],
    initialized: false,
    nextSendAt: 0,
    lastSentByFeed: {},
  };
  try {
    if (existsSync(PUSH_STATE_FILE)) {
      const stored = JSON.parse(
        readFileSync(PUSH_STATE_FILE, "utf-8"),
      ) as Partial<PushState>;
      state = { ...empty, ...stored };
    }
  } catch (error) {
    logger.error(`Failed to load push state: ${String(error)}`);
  }
  state = state || empty;
  return state;
};

const saveState = (): void => {
  if (!state) return;
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(PUSH_STATE_FILE, JSON.stringify(state), "utf-8");
  } catch (error) {
    logger.error(`Failed to save push state: ${String(error)}`);
  }
};

// VAPID keys should be set via env so they survive redeploys; otherwise a pair is
// generated once and kept next to the rest of the cache (clients resubscribe if it changes)
const getVapidKeys = (): { publicKey: string; privateKey: string } => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  }
  const current = loadState();
  if (!current.vapid) {
    current.vapid = webpush.generateVAPIDKeys();
    saveState();
    logger.info("Generated a new VAPID key pair for web push");
  }
  return current.vapid;
};

export const getPushConfig = (): { enabled: boolean; publicKey: string } => {
  return {
    enabled: schedulerRunning,
    publicKey: schedulerRunning ? getVapidKeys().publicKey : "",
  };
};

const isValidSubscription = (value: unknown): value is PushSubscriptionJSON => {
  const sub = value as PushSubscriptionJSON | null;
  return (
    sub !== null &&
    typeof sub === "object" &&
    typeof sub.endpoint === "string" &&
    /^https:\/\//.test(sub.endpoint) &&
    typeof sub.keys === "object" &&
    sub.keys !== null &&
    typeof sub.keys.p256dh === "string" &&
    typeof sub.keys.auth === "string"
  );
};

// Returns true when the subscription was not known before
export const addSubscription = (subscription: unknown): boolean => {
  if (!isValidSubscription(subscription)) {
    throw new Error("Invalid push subscription");
  }
  const current = loadState();
  const existing = current.subscriptions.findIndex(
    (sub) => sub.endpoint === subscription.endpoint,
  );
  const clean: PushSubscriptionJSON = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  };
  if (existing >= 0) {
    current.subscriptions[existing] = clean;
  } else {
    current.subscriptions.push(clean);
  }
  saveState();
  return existing < 0;
};

export const removeSubscription = (endpoint: string): void => {
  const current = loadState();
  const before = current.subscriptions.length;
  current.subscriptions = current.subscriptions.filter(
    (sub) => sub.endpoint !== endpoint,
  );
  if (current.subscriptions.length !== before) saveState();
};

// TLDR titles end in "(5 minute read)" or "(GitHub Repo)", which only adds noise in a notification
export const cleanTitle = (title: string): string =>
  title.replace(/\s*\((\d+\s+minute\s+read|github repo)\)\s*$/i, "").trim();

const truncate = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

const feedLabel = (feed: string): string =>
  feed === "leadership" ? "Leadership in Tech" : `TLDR ${getDisplayName(feed)}`;

export const buildPayload = (
  insight: QueuedInsight,
): Record<string, unknown> => {
  return {
    title: cleanTitle(insight.title),
    body: `${feedLabel(insight.feed)} · ${truncate(insight.content, 160)}`,
    image: insight.image,
    link: insight.link,
    url: `/reader?url=${encodeURIComponent(insight.link)}`,
    tag: `insight:${insight.link}`,
  };
};

/**
 * Remembers every article seen so far and queues the ones that are new. The very first
 * run only takes a baseline (plus what was published in the last day) so that enabling
 * notifications doesn't unleash the whole backlog.
 */
export const collectNewInsights = (
  current: Pick<PushState, "seen" | "queue" | "initialized">,
  itemsByFeed: Record<string, NewsWithDate[]>,
  now: number,
): number => {
  const seen = new Set(current.seen);
  let added = 0;
  for (const [feed, items] of Object.entries(itemsByFeed)) {
    for (const item of items) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      current.seen.push(item.link);
      const recent = now - new Date(item.date).getTime() < 24 * ONE_HOUR;
      if (current.initialized || recent) {
        current.queue.push({
          link: item.link,
          title: item.title,
          content: item.content,
          image: item.image,
          feed,
          date: item.date,
          queuedAt: now,
        });
        added++;
      }
    }
  }
  current.initialized = true;
  if (current.seen.length > MAX_SEEN_ENTRIES) {
    current.seen = current.seen.slice(current.seen.length - MAX_SEEN_ENTRIES);
  }
  return added;
};

/**
 * Drops stale or already read insights and picks the next one: the newest article of the
 * feed that was notified least recently, so consecutive pushes rotate through the feeds.
 */
export const pickNextInsight = (
  current: Pick<PushState, "queue" | "lastSentByFeed">,
  now: number,
  maxAgeMs: number,
  alreadyRead: (link: string) => boolean,
): QueuedInsight | null => {
  current.queue = current.queue.filter(
    (item) => now - item.queuedAt < maxAgeMs && !alreadyRead(item.link),
  );
  if (current.queue.length === 0) return null;

  const [next] = [...current.queue].sort((a, b) => {
    const lastA = current.lastSentByFeed[a.feed] || 0;
    const lastB = current.lastSentByFeed[b.feed] || 0;
    if (lastA !== lastB) return lastA - lastB;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  current.queue = current.queue.filter((item) => item !== next);
  current.lastSentByFeed[next.feed] = now;
  return next;
};

const send = async (
  subscriptions: PushSubscriptionJSON[],
  payload: Record<string, unknown>,
): Promise<void> => {
  const vapid = getVapidKeys();
  const subject = process.env.VAPID_SUBJECT || "mailto:tldr-reader@example.com";
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, body, {
          TTL: 6 * 60 * 60,
          urgency: "normal",
          vapidDetails: { subject, ...vapid },
        });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          logger.info("Removing expired push subscription");
          removeSubscription(subscription.endpoint);
        } else {
          logger.warn(`Failed to send push notification: ${String(error)}`);
        }
      }
    }),
  );
};

export const sendWelcomeNotification = async (
  subscription: PushSubscriptionJSON,
): Promise<void> => {
  await send([subscription], {
    title: "Benachrichtigungen aktiv",
    body: "Ab jetzt kommt immer mal wieder ein neuer Insight – einer nach dem anderen statt alle auf einmal.",
    url: "/feed.html",
    tag: "welcome",
  });
};

export const refreshPushQueue = async (): Promise<void> => {
  const itemsByFeed: Record<string, NewsWithDate[]> = {};
  for (const feed of FEEDS) {
    try {
      // Served from the cache that was just warmed
      itemsByFeed[feed] = await fetchFeedNews(feed);
    } catch (error) {
      logger.warn(`Push: could not load ${feed}: ${String(error)}`);
    }
  }
  const current = loadState();
  const added = collectNewInsights(current, itemsByFeed, Date.now());
  saveState();
  if (added > 0) {
    logger.info(
      `Push: queued ${added} new insights (${current.queue.length} waiting)`,
    );
  }
};

export const pushTick = async (now = Date.now()): Promise<void> => {
  const current = loadState();
  const settings = getPushSettings();
  if (current.subscriptions.length === 0 || now < current.nextSendAt) return;
  if (isQuietTime(new Date(now), settings.quietHours, settings.timeZone))
    return;

  const next = pickNextInsight(
    current,
    now,
    settings.maxAgeHours * ONE_HOUR,
    isRead,
  );
  if (!next) {
    saveState();
    return;
  }

  // Irregular spacing (±30%) feels less like a timer going off
  const jitter = 0.7 + Math.random() * 0.6;
  current.nextSendAt = now + settings.intervalMinutes * 60 * 1000 * jitter;
  saveState();
  await send(current.subscriptions, buildPayload(next));
};

// Only the long-running server starts this; on serverless there is no process to drip from
export const startPushScheduler = (): void => {
  if (schedulerRunning) return;
  schedulerRunning = true;
  getVapidKeys();
  setInterval(() => {
    pushTick().catch((error) =>
      logger.error(`Push tick failed: ${String(error)}`),
    );
  }, TICK_MS);
};
