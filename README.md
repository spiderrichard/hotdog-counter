# Hotdog Counter (Slack → Cloudflare Worker + D1)

Counts :hotdog: emoji (and the 🌭 Unicode) in Slack **messages** and **reactions**.  
Stores per-user and per-channel totals in **Cloudflare D1**.  
Includes a `/hotdogs` slash command with a leaderboard and `/hotdogs me`.

## Endpoints

- `POST /slack/events`   — Slack Events API (message + reaction events)
- `POST /slack/command`  — Slack Slash command (`/hotdogs`)

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
