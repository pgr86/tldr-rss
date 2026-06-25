# Twitter/X Sharing

Feed content (starting with the **AI** feed) can be shared on X in two ways.
Both reuse the **same four X API credentials** (OAuth 1.0a, Read + Write).

1. **Automated (the cron)** — the `Update RSS` GitHub Action
   ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) runs daily
   and, while generating the feeds, posts newly seen AI articles via
   [`src/twitter.ts`](../src/twitter.ts) using the `twitter-api-v2` library.
   This is the path you asked for and is described under
   [Automated posting](#automated-posting-the-cron) below.

2. **Interactive (Claude Code)** — the [`@enescinar/twitter-mcp`](https://github.com/EnesCinr/twitter-mcp)
   MCP server in [`.mcp.json`](../.mcp.json) lets Claude post manually inside a
   session. It exposes `post_tweet` and `search_tweets`. MCP servers only work in
   an interactive session — **not** in the cron — which is why the automated path
   uses the library directly.

## Automated posting (the cron)

On each scheduled run, for every feed listed in `TWITTER_FEEDS` (currently `ai`):

- Articles already tweeted are tracked in `.twitter-state/posted-<feed>.json`,
  persisted between runs via the workflow's `actions/cache` step.
- **First run** (no state yet) seeds the state **without posting**, so a backlog
  of older articles is not dumped at once. Real posting begins on the next run
  with genuinely new articles.
- Each run posts up to `MAX_TWEETS_PER_RUN` (default `5`) new articles, newest
  first; any remainder follows on subsequent runs.
- Without credentials the whole step is a safe no-op, so feed generation and CI
  keep working.

## What you must provide

The MCP config references **four environment variables** — no secrets are stored
in the repo. You need X API credentials with **Read + Write** permission
(OAuth 1.0a user context), created at <https://developer.x.com/>:

| Variable name                 | X developer portal value      |
| ----------------------------- | ----------------------------- |
| `TWITTER_API_KEY`             | API Key / Consumer Key        |
| `TWITTER_API_SECRET_KEY`      | API Secret / Consumer Secret  |
| `TWITTER_ACCESS_TOKEN`        | Access Token                  |
| `TWITTER_ACCESS_TOKEN_SECRET` | Access Token Secret           |

> The app's **User authentication settings** must be set to **Read and Write**
> *before* generating the Access Token, otherwise posting returns 403.

## Enable the automated cron path

1. **Create X API credentials** (Read + Write) in the X developer portal.
2. **Add the four values as GitHub Actions secrets** in the repository
   (`Settings → Secrets and variables → Actions`), using the exact names above.
   The `Update RSS` workflow already passes them to `yarn start`.
3. That's it — the next scheduled run seeds the state, and the run after that
   starts posting new AI articles. Trigger a manual run via **workflow_dispatch**
   to start immediately.

Tuning: `MAX_TWEETS_PER_RUN` (default `5`) and `TWITTER_FEEDS` (in
[`src/index.ts`](../src/index.ts)) control volume and which feeds are shared.

## Enable the interactive MCP path (optional)

1. Same credentials as above, but provided as **environment variables** in the
   web environment's settings. See
   <https://code.claude.com/docs/en/claude-code-on-the-web>.
2. **Allow network egress** to: `api.x.com` / `api.twitter.com`,
   `upload.twitter.com`, and `registry.npmjs.org` (so `npx` can fetch the server).
3. **Restart the environment/session** — MCP servers connect at session start,
   so the `twitter` server (tool `mcp__twitter__post_tweet`) only appears after a
   fresh start.

## Notes / limits

- The X **Free** tier currently allows a limited number of writes per month;
  check your tier if posts start failing with 429.
- Tweets are capped at 280 characters — long titles are truncated and the
  article link is appended.
- Posting is public and not easily reversible. The automated path mitigates this
  by seeding (not posting) on the first run and capping posts per run.
