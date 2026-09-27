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

## Push notifications

Installed as an app (PWA), the feed pages show a bell in the header. Tapping it asks for
notification permission and subscribes the device via Web Push.

New articles are not pushed as soon as a newsletter drops. The server queues them and
sends **one insight at a time**, roughly every `PUSH_INTERVAL_MINUTES` (±30 % jitter).
Each push rotates to a different feed and picks that feed's newest article. Articles that
have already been read, or that waited longer than `PUSH_MAX_AGE_HOURS`, are skipped.
Tapping a notification opens the article in the reader and marks it as read. "Gelesen"
marks it as read without opening it.

This needs the long-running Node server (`node dist/server`, e.g. the Docker image). On
Vercel there is no process that could send pushes, so the bell stays hidden there.

| Variable | Default | Description |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | generated | Web Push keys. Generate a pair once with `npx web-push generate-vapid-keys` and set both. Otherwise a pair is generated into `.cache/` and changes whenever that directory is lost. Devices then resubscribe on their next app launch. |
| `VAPID_SUBJECT` | `mailto:tldr-reader@example.com` | Contact address sent to the push services |
| `PUSH_INTERVAL_MINUTES` | `45` | Average gap between two notifications |
| `PUSH_MAX_AGE_HOURS` | `36` | Queued articles older than this are dropped |
| `PUSH_QUIET_HOURS` | `22-7` | No notifications in this local time window (`off` disables it) |
| `PUSH_TIMEZONE` | `Europe/Berlin` | Time zone for the quiet hours |

Subscriptions and the queue live in `.cache/push_state.json`. Mount `.cache` as a volume
so they survive redeploys.

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
- `/leadership.rss`
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
