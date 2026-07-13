import http from "http";
import url from "url";
import handler from "../api/feed";

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Parse URL and query params
  const parsedUrl = url.parse(req.url || "", true);
  const pathname = parsedUrl.pathname || "";

  // Implement Vercel-like rewrites
  const query = { ...parsedUrl.query } as Record<string, string | string[] | undefined>;
  
  const rssMatch = pathname.match(/^\/([^/]+)\.rss$/);
  if (rssMatch) {
    query.feed = rssMatch[1];
    query.format = "rss";
  }

  const htmlMatch = pathname.match(/^\/([^/]+)\.html$/);
  if (htmlMatch) {
    query.feed = htmlMatch[1];
    query.format = "html";
  }
  
  // Construct a request-like object for the handler
  const requestLike = {
    headers: req.headers as Record<string, string | string[] | undefined>,
    query,
    url: req.url,
  };

  // Construct a response-like object for the handler
  const responseLike = {
    status(code: number) {
      res.statusCode = code;
      return responseLike;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
    },
    send(body: string) {
      res.end(body);
    },
    json(body: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    }
  };

  try {
    await handler(requestLike, responseLike);
  } catch (error) {
    console.error("Error handling request:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
