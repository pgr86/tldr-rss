# TLDR RSS

[![Update RSS](https://github.com/Bullrich/tldr-rss/actions/workflows/deploy.yml/badge.svg)](https://github.com/Bullrich/tldr-rss/actions/workflows/deploy.yml)

Recollection of [TLDR](https://tldr.tech) feeds. Unified into a single RSS feed.

Why?

Because `TLDR` feed publishes only one article per day, but inside this article it has many articles (around 12). I created this tool to access all of them from my RSS reader instead of having to go into each single one individually.

## Configuration

### Environment Variables

- `MAX_DAYS` (optional): Maximum number of days in the past to fetch articles from. Defaults to 10 if not set.

Example:
```bash
MAX_DAYS=7 yarn start  # Fetch articles from the last 7 days
```

## Vercel deployment

This repository is set up to run on Vercel using dynamic serverless generation.

- `/*.rss` and `/*.html` are generated on request by `api/feed.ts`
- Vercel caches feed responses for 4 hours with `Cache-Control: public, s-maxage=14400`
- Generated files are no longer expected to persist on disk in production

### Routes

- `/feed.rss`
- `/tech.rss`
- `/ai.rss`
- `/crypto.rss`
- `/product.rss`
- `/design.rss`
- `/dev.rss`
- `/devops.rss`
- `/marketing.rss`
- `/data.rss`
- `/fintech.rss`
- `/tech.html` and the same pattern for the individual feeds above

### Deploy steps

1. Import the repo into Vercel.
2. Keep the project as an Other framework project.
3. Set `MAX_DAYS` in Vercel Environment Variables if you want something other than the default `10`.
4. Deploy.

### Local development

You can still generate static files locally:

```bash
npm install
npm run build
npm start
```

For Vercel local development:

```bash
npx vercel dev
```
