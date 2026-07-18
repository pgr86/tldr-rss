import http from "http";
import url from "url";
import path from "path";
import fs from "fs/promises";
import handler from "../api/feed";
import { fetchAllFeeds } from "./feed";

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Parse URL and query params
  const parsedUrl = url.parse(req.url || "", true);
  let pathname = parsedUrl.pathname || "";

  // 1. Serve static files from public directory (useful in self-hosted Docker environments like Coolify)
  if (pathname === "/") {
    pathname = "/index.html";
  }
  const publicFilePath = path.join(process.cwd(), "public", pathname);
  try {
    const stat = await fs.stat(publicFilePath);
    if (stat.isFile()) {
      let contentType = "application/octet-stream";
      if (pathname.endsWith(".html")) {
        contentType = "text/html; charset=utf-8";
      } else if (pathname.endsWith(".png")) {
        contentType = "image/png";
      } else if (pathname.endsWith(".ico")) {
        contentType = "image/x-icon";
      } else if (pathname.endsWith(".css")) {
        contentType = "text/css; charset=utf-8";
      }
      
      const fileData = await fs.readFile(publicFilePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(fileData);
      return;
    }
  } catch {
    // File not found in public, continue to Vercel-like rewrites
  }

  // Restore path to original for rewrite matching
  pathname = parsedUrl.pathname || "";

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
    method: req.method,
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

// Background cache warming helper
const warmCache = async () => {
  try {
    console.log("Starting background cache warming...");
    await fetchAllFeeds();
    console.log("Background cache warming completed successfully.");
  } catch (error) {
    console.error("Error warming cache in background:", error);
  }
};

// Warm cache on startup
warmCache();

// Periodically warm cache every hour
const ONE_HOUR = 60 * 60 * 1000;
setInterval(warmCache, ONE_HOUR);
