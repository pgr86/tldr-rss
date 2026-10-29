import handler from "../../api/feed";
import { fetchReaderArticle } from "../reader";

jest.mock("../reader", () => {
  return {
    ...jest.requireActual<typeof import("../reader")>("../reader"),
    fetchReaderArticle: jest.fn(),
  };
});

const mockedFetch = fetchReaderArticle as jest.MockedFunction<
  typeof fetchReaderArticle
>;

const article = {
  title: "Article",
  domain: "example.com",
  originalUrl: "https://example.com/a",
  contentHtml: "<p>Body</p>",
  readingTimeMinutes: 1,
};

const requestReader = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  const res = {
    status: () => res,
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    send: () => undefined,
    json: () => undefined,
  };
  await handler(
    {
      headers: { host: "localhost" },
      query: { url: "https://example.com/a", password: "Test@123" },
      url: "/reader?url=https%3A%2F%2Fexample.com%2Fa&password=Test%40123",
      method: "GET",
    },
    res,
  );
  return headers;
};

describe("reader route caching", () => {
  it("marks fallback pages and forbids caching them", async () => {
    mockedFetch.mockResolvedValueOnce({ ...article, isFallback: true });
    const headers = await requestReader();
    expect(headers["x-reader-fallback"]).toBe("1");
    expect(headers["cache-control"]).toBe("no-store");
  });

  it("keeps the long cache for extracted articles", async () => {
    mockedFetch.mockResolvedValueOnce(article);
    const headers = await requestReader();
    expect(headers["x-reader-fallback"]).toBeUndefined();
    expect(headers["cache-control"]).toContain("s-maxage=");
  });
});
