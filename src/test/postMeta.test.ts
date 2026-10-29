import { sourceHost, splitReadingTime } from "../postMeta";

describe("splitReadingTime", () => {
  it("moves a trailing reading time out of the title", () => {
    expect(
      splitReadingTime("Gemini 4 Carbon is here (17 minute read)"),
    ).toEqual({ title: "Gemini 4 Carbon is here", minutes: 17 });
  });

  it("is case-insensitive and tolerates extra spaces", () => {
    expect(splitReadingTime("Foo  (3 Minute Read) ")).toEqual({
      title: "Foo",
      minutes: 3,
    });
  });

  it("keeps other bracket suffixes", () => {
    expect(splitReadingTime("Cool tool (GitHub Repo)")).toEqual({
      title: "Cool tool (GitHub Repo)",
    });
  });

  it("leaves plain titles alone", () => {
    expect(splitReadingTime("Plain title")).toEqual({ title: "Plain title" });
  });
});

describe("sourceHost", () => {
  it("strips www", () => {
    expect(sourceHost("https://www.theverge.com/a/b")).toBe("theverge.com");
  });

  it("keeps subdomains", () => {
    expect(sourceHost("https://blog.example.com/x")).toBe("blog.example.com");
  });

  it("returns an empty string for invalid links", () => {
    expect(sourceHost("not a url")).toBe("");
  });
});
