import axios from "axios";

import { getCache, setCache } from "./cache";
import { logger } from "./util";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Alias that always points to the newest Claude Haiku: fast and cheap enough for summaries
export const DEFAULT_SUMMARY_MODEL = "~anthropic/claude-haiku-latest";

// The reader assumes 200 words per minute, so this stays below one minute
export const SUMMARY_MAX_WORDS = 180;

// Enough for long reads; keeps the prompt (and the bill) bounded
export const MAX_ARTICLE_CHARS = 40000;

export type ArticleSummary = {
  summaryHtml: string;
  wordCount: number;
  readingSeconds: number;
};

const SYSTEM_PROMPT = `Du fasst Artikel für einen News-Reader zusammen.
- Antworte immer auf Deutsch, egal in welcher Sprache der Artikel ist.
- Höchstens ${SUMMARY_MAX_WORDS} Wörter, damit die Zusammenfassung in unter einer Minute gelesen ist.
- Format: zuerst ein Satz mit der Kernaussage, dann eine Leerzeile, dann 3 bis 5 Stichpunkte, die jeweils mit "- " beginnen.
- Hebe höchstens einen Schlüsselbegriff pro Stichpunkt mit **fett** hervor. Sonst kein Markdown, keine Überschrift, keine Einleitung wie "Der Artikel beschreibt".
- Gib nur wieder, was im Artikel steht. Erfinde keine Zahlen, Namen oder Bewertungen.`;

export const isSummaryEnabled = (): boolean =>
  Boolean(process.env.OPENROUTER_API_KEY);

const getModel = (): string =>
  process.env.OPENROUTER_MODEL || DEFAULT_SUMMARY_MODEL;

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatInline = (text: string): string =>
  escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Turns the model's plain text answer into safe HTML (paragraphs and one bullet list) */
export const renderSummaryHtml = (text: string): string => {
  const blocks: string[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length > 0) {
      blocks.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
      bullets = [];
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^#+\s*$/.test(line)) {
      flushBullets();
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      bullets.push(formatInline(bullet[1]));
    } else {
      flushBullets();
      blocks.push(`<p>${formatInline(line.replace(/^#+\s+/, ""))}</p>`);
    }
  }
  flushBullets();

  return blocks.join("\n");
};

const countWords = (text: string): number =>
  text.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length;

const inFlight = new Map<string, Promise<ArticleSummary>>();

const requestSummary = async (
  title: string,
  text: string,
): Promise<ArticleSummary> => {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: getModel(),
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Titel: ${title}\n\n${text.slice(0, MAX_ARTICLE_CHARS)}`,
        },
      ],
    },
    {
      timeout: 45000,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "TLDR RSS Reader",
      },
    },
  );

  const content: unknown = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Das Modell hat keine Zusammenfassung geliefert");
  }

  const wordCount = countWords(content);
  return {
    summaryHtml: renderSummaryHtml(content),
    wordCount,
    readingSeconds: Math.max(5, Math.round((wordCount / 200) * 60)),
  };
};

export const summarizeArticle = async (
  url: string,
  title: string,
  text: string,
): Promise<ArticleSummary> => {
  if (!isSummaryEnabled()) {
    throw new Error("OPENROUTER_API_KEY ist nicht gesetzt");
  }

  const cacheKey = `summary:${getModel()}:${url}`;
  const cached = getCache<ArticleSummary>(cacheKey);
  if (cached) return cached;

  // Two taps (or the split view and a tab) should not pay for the same summary twice
  const pending = inFlight.get(cacheKey);
  if (pending) return await pending;

  const promise = requestSummary(title, text)
    .then((summary) => {
      setCache(cacheKey, summary);
      return summary;
    })
    .catch((error: unknown) => {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { error?: { message?: string } })?.error
            ?.message || error.message
        : error instanceof Error
          ? error.message
          : String(error);
      logger.warn(
        `Summary failed for ${url}${status ? ` (${status})` : ""}: ${message}`,
      );
      throw new Error(message);
    })
    .finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, promise);
  return await promise;
};
