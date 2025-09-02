-- Per (channel, user) counts
CREATE TABLE IF NOT EXISTS hotdog_counts (
  channel_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (channel_id, user_id)
);

-- Per-channel total
CREATE TABLE IF NOT EXISTS channel_totals (
  channel_id TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Processed Slack event IDs for idempotency
CREATE TABLE IF NOT EXISTS processed_events (
  event_id    TEXT PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
