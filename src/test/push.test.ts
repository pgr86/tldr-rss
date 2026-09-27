import {
  buildPayload,
  cleanTitle,
  collectNewInsights,
  isQuietTime,
  parseQuietHours,
  pickNextInsight,
  type QueuedInsight,
} from "../push";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-09-27T12:00:00Z").getTime();

const news = (link: string, hoursAgo: number) => {
  return {
    title: `Title ${link}`,
    link,
    content: `Content ${link}`,
    date: new Date(NOW - hoursAgo * HOUR).toISOString(),
  };
};

const queued = (link: string, feed: string, hoursAgo = 1): QueuedInsight => {
  return {
    ...news(link, hoursAgo),
    feed,
    queuedAt: NOW - hoursAgo * HOUR,
  };
};

describe("collectNewInsights", () => {
  it("only queues the last day on the first run, then everything new", () => {
    const state = {
      seen: [] as string[],
      queue: [] as QueuedInsight[],
      initialized: false,
    };

    collectNewInsights(state, { ai: [news("old", 48), news("fresh", 2)] }, NOW);
    expect(state.queue.map((item) => item.link)).toEqual(["fresh"]);
    expect(state.initialized).toBe(true);

    const added = collectNewInsights(
      state,
      { ai: [news("old", 48), news("fresh", 2), news("next", 72)] },
      NOW,
    );
    expect(added).toBe(1);
    expect(state.queue.map((item) => item.link)).toEqual(["fresh", "next"]);
  });
});

describe("pickNextInsight", () => {
  it("rotates through feeds, newest first, and skips read or expired items", () => {
    const lastSentByFeed: Record<string, number> = { tech: NOW - HOUR };
    const state = {
      queue: [
        queued("ai-old", "ai", 3),
        queued("ai-new", "ai", 1),
        queued("tech-1", "tech", 2),
        queued("read", "design", 1),
        queued("expired", "crypto", 50),
      ],
      lastSentByFeed,
    };
    const isRead = (link: string) => link === "read";

    expect(pickNextInsight(state, NOW, 36 * HOUR, isRead)?.link).toBe("ai-new");
    expect(pickNextInsight(state, NOW + 1, 36 * HOUR, isRead)?.link).toBe(
      "tech-1",
    );
    expect(pickNextInsight(state, NOW + 2, 36 * HOUR, isRead)?.link).toBe(
      "ai-old",
    );
    expect(pickNextInsight(state, NOW + 3, 36 * HOUR, isRead)).toBeNull();
  });
});

describe("quiet hours", () => {
  it("parses ranges and handles overnight windows", () => {
    expect(parseQuietHours(undefined)).toEqual({ start: 22, end: 7 });
    expect(parseQuietHours("off")).toBeNull();
    const quiet = parseQuietHours("22-7");
    // 21:30 UTC is 23:30 in Berlin (CEST)
    expect(
      isQuietTime(new Date("2026-09-27T21:30:00Z"), quiet, "Europe/Berlin"),
    ).toBe(true);
    expect(
      isQuietTime(new Date("2026-09-27T10:00:00Z"), quiet, "Europe/Berlin"),
    ).toBe(false);
    expect(
      isQuietTime(new Date("2026-09-27T04:59:00Z"), quiet, "Europe/Berlin"),
    ).toBe(true);
    expect(
      isQuietTime(new Date("2026-09-27T05:00:00Z"), quiet, "Europe/Berlin"),
    ).toBe(false);
  });
});

describe("buildPayload", () => {
  it("strips reading time and links to the reader", () => {
    expect(cleanTitle("Big News (5 minute read)")).toBe("Big News");
    const payload = buildPayload({
      ...queued("https://example.com/a?b=1", "ai"),
      title: "Big News (3 minute read)",
    });
    expect(payload.title).toBe("Big News");
    expect(payload.body).toMatch(/^TLDR AI · /);
    expect(payload.url).toBe(
      "/reader?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1",
    );
  });
});
