# Twitter/X MCP Setup

This repo is configured to expose a Twitter/X MCP server to Claude Code so that
feed content (starting with the **AI** feed) can be shared on X directly.

The server used is [`@enescinar/twitter-mcp`](https://github.com/EnesCinr/twitter-mcp),
configured in [`.mcp.json`](../.mcp.json). It exposes two tools:

- `post_tweet` – publish a tweet
- `search_tweets` – search X

## What you must provide

The MCP config references **four environment variables** — no secrets are stored
in the repo. You need X API credentials with **Read + Write** permission
(OAuth 1.0a user context), created at <https://developer.x.com/>:

| Env var (in this environment) | X developer portal value      |
| ----------------------------- | ----------------------------- |
| `TWITTER_API_KEY`             | API Key / Consumer Key        |
| `TWITTER_API_SECRET_KEY`      | API Secret / Consumer Secret  |
| `TWITTER_ACCESS_TOKEN`        | Access Token                  |
| `TWITTER_ACCESS_TOKEN_SECRET` | Access Token Secret           |

> The app's **User authentication settings** must be set to **Read and Write**
> *before* generating the Access Token, otherwise posting returns 403.

## Steps to enable

1. **Create X API credentials** (Read + Write) in the X developer portal.
2. **Add the four variables as secrets** in this environment's settings
   (Environment variables / secrets). See
   <https://code.claude.com/docs/en/claude-code-on-the-web>.
3. **Allow network egress** to the hosts the server needs:
   - `api.x.com` / `api.twitter.com` (posting & search)
   - `upload.twitter.com` (media, if used)
   - `registry.npmjs.org` (so `npx` can fetch the package)
4. **Restart the environment/session.** MCP servers connect at session start, so
   the `twitter` server only becomes available after a fresh start.

## Verifying

After restart, the tool `mcp__twitter__post_tweet` should be available. A quick
check is to ask for a search (read-only) before the first post.

## Notes / limits

- The X **Free** tier currently allows a limited number of writes per month;
  check your tier if posts start failing with 429.
- Tweets are capped at 280 characters — feed items will be summarized/truncated
  with a link back to the article.
- Posting is public and not easily reversible; each batch of posts will be
  confirmed before sending.
