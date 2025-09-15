# Hotdog Counter (Slack → Cloudflare Worker + D1)

Counts :hotdog: emoji (and the 🌭 Unicode) in Slack **messages** and **reactions**.  
Stores per-user and per-channel totals in **Cloudflare D1**.  
Includes a `/hotdogs` slash command with a leaderboard and `/hotdogs me`.

## Endpoints

- `POST /slack/events`   — Slack Events API (message + reaction events)
- `POST /slack/command`  — Slack Slash command (`/hotdogs`)
- `GET  /api/channels`   — Public JSON of channels + totals (for static sites)
- `GET  /api/leaderboard?channel_id=…&limit=…` — Public JSON leaderboard

## Quick start (local + deploy)

### 0) Prereqs
- Cloudflare account
- `npm i -g wrangler` (or use `npx wrangler`)
- A Slack app (created "from scratch")

### 1) Create D1 and apply migrations

```bash
# Create a D1 database (choose your own name)
wrangler d1 create hotdog-db

# Note: copy the "database_id" it prints; you'll paste into wrangler.toml.

# Apply schema
wrangler d1 execute hotdog-db --file=./migrations/0001_init.sql

## GitHub Pages (static site)

This repo includes a simple static site in `docs/` that fetches read‑only JSON from the Worker to display a leaderboard.

1) Deploy your Worker (so it has a public URL).
2) Edit `docs/config.js` and set `window.API_BASE` to your Worker base URL (e.g., `https://<name>.<account>.workers.dev`).
3) Commit and push.
4) In GitHub → Settings → Pages, set Source to “Deploy from a branch”, Branch `main`, Folder `/docs`.

The site will be available at `https://<user>.github.io/<repo>/`. CORS is enabled for the read‑only API endpoints so the page can fetch data from your Worker.
