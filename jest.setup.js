const os = require("os");
const path = require("path");

// Tests must neither read nor change the real Merkliste in .cache/
process.env.BOOKMARKS_FILE = path.join(
  os.tmpdir(),
  `tldr-rss-bookmarks-${process.pid}-${process.env.JEST_WORKER_ID || "0"}.json`,
);
