import axios from "axios";

import * as cache from "../cache";
import {
  DEFAULT_SUMMARY_MODELS,
  getSummaryModels,
  renderSummaryHtml,
  summarizeArticle,
} from "../summary";

const ARTICLE_TEXT = "Ein langer Artikeltext. ".repeat(40);

describe("renderSummaryHtml", () => {
  it("turns the lead sentence and bullets into paragraphs and a list", () => {
    const html = renderSummaryHtml(
      "Kernaussage des Artikels.\n\n- Erster **Punkt**\n- Zweiter Punkt",
    );

    expect(html).toBe(
      "<p>Kernaussage des Artikels.</p>\n<ul><li>Erster <strong>Punkt</strong></li><li>Zweiter Punkt</li></ul>",
    );
  });

  it("escapes HTML coming from the model", () => {
    const html = renderSummaryHtml(
      '<img src=x onerror="alert(1)">\n- <b>x</b>',
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img");
  });
});

describe("summarizeArticle", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    jest.spyOn(cache, "getCache").mockReturnValue(null);
    jest.spyOn(cache, "setCache").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });

  it("asks OpenRouter for a German summary and renders the answer", async () => {
    const post = jest.spyOn(axios, "post").mockResolvedValue({
      data: {
        choices: [
          { message: { content: "Kurz gesagt.\n\n- Eins\n- Zwei\n- Drei" } },
        ],
      },
    });

    const summary = await summarizeArticle(
      "https://example.com/a",
      "Titel",
      ARTICLE_TEXT,
    );

    expect(summary.summaryHtml).toContain("<li>Eins</li>");
    expect(summary.wordCount).toBe(8);
    expect(summary.readingSeconds).toBeLessThan(60);

    const [url, body, config] = post.mock.calls[0] as [
      string,
      { messages: { role: string; content: string }[] },
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((body as unknown as { model: string }).model).toBe(
      DEFAULT_SUMMARY_MODELS[0],
    );
    expect(body.messages[0].content).toContain("Deutsch");
    expect(body.messages[1].content).toContain("Titel: Titel");
    expect(config.headers.Authorization).toBe("Bearer test-key");
    expect(cache.setCache).toHaveBeenCalled();
  });

  it("falls back to the next free model when one fails", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        data: {
          model: "nvidia/nemotron-3-super-120b-a12b:free",
          choices: [
            { message: { content: "<think>hmm</think>Kurz gesagt.\n- Eins" } },
          ],
        },
      });

    const summary = await summarizeArticle(
      "https://example.com/b",
      "Titel",
      ARTICLE_TEXT,
    );

    const models = post.mock.calls.map(
      (call) => (call[1] as { model: string }).model,
    );
    expect(models).toEqual(DEFAULT_SUMMARY_MODELS.slice(0, 2));
    expect(summary.model).toBe("nvidia/nemotron-3-super-120b-a12b:free");
    expect(summary.summaryHtml).not.toContain("hmm");
  });

  it("uses the models from OPENROUTER_MODEL", () => {
    process.env.OPENROUTER_MODEL = "a/one, b/two";
    expect(getSummaryModels()).toEqual(["a/one", "b/two"]);
    delete process.env.OPENROUTER_MODEL;
    expect(getSummaryModels()).toEqual(DEFAULT_SUMMARY_MODELS);
  });

  it("serves a cached summary without calling the API", async () => {
    const cached = {
      summaryHtml: "<p>x</p>",
      wordCount: 1,
      readingSeconds: 5,
      model: "x",
    };
    jest.spyOn(cache, "getCache").mockReturnValue(cached);
    const post = jest.spyOn(axios, "post");

    await expect(
      summarizeArticle("https://example.com/a", "Titel", ARTICLE_TEXT),
    ).resolves.toEqual(cached);
    expect(post).not.toHaveBeenCalled();
  });

  it("fails without an API key", async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      summarizeArticle("https://example.com/a", "Titel", ARTICLE_TEXT),
    ).rejects.toThrow("OPENROUTER_API_KEY");
  });
});
