// Hotdog Counter — Slack Events + Slash Command on Cloudflare Workers + D1
// Counts :hotdog: and the Unicode 🌭 in channel messages and reaction_added events.

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/slack/events") {
      return handleSlackEvents(request, env);
    }
    if (pathname === "/slack/command") {
      return handleSlashCommand(request, env);
    }

    if (pathname === "/health") return new Response("ok"); // simple health check
    return new Response("Not Found", { status: 404 });
  }
};

/* ===== Config (optional channel allow-list) ===== */

const ALLOWED_CHANNELS = null;
// e.g. const ALLOWED_CHANNELS = new Set(["C0123ABCDEF"]); // only count in these channels

/* ===== Slack Event Handler ===== */

async function handleSlackEvents(request, env) {
  // Verify Slack signature
  if (!(await verifySlackSignature(request, env.SLACK_SIGNING_SECRET))) {
    return new Response("Bad signature", { status: 401 });
  }

  const raw = await request.text();
  const payload = JSON.parse(raw);

  // URL verification handshake
  if (payload.type === "url_verification") {
    return json({ challenge: payload.challenge });
  }

  const eventId = payload?.event_id;
  if (eventId) {
    const seen = await env.DB.prepare(
      "SELECT 1 FROM processed_events WHERE event_id = ?"
    ).bind(eventId).first();

    if (seen) return new Response("", { status: 200 });
  }

  try {
    if (payload.type === "event_callback") {
      const e = payload.event;

      // Messages in public channels
      if (e.type === "message" && !e.subtype && e.channel && e.user) {
        if (ALLOWED_CHANNELS && !ALLOWED_CHANNELS.has(e.channel)) {
          // do nothing
        } else {
          const inc = countHotdogs(e.text || "");
          if (inc > 0) {
            await incrementCounts(env.DB, e.channel, e.user, inc);
          }
        }
      }

      // Reactions
      if (e.type === "reaction_added") {
        const ch = e.item?.channel;
        if (ch && e.user && e.reaction === "hotdog") {
          if (!ALLOWED_CHANNELS || ALLOWED_CHANNELS.has(ch)) {
            await incrementCounts(env.DB, ch, e.user, 1);
          }
        }
      }
    }

    if (eventId) {
      await env.DB.prepare(
        "INSERT INTO processed_events (event_id) VALUES (?)"
      ).bind(eventId).run();
    }

    return new Response("", { status: 200 });
  } catch (err) {
    console.error("Event error:", err);
    return new Response("Server error", { status: 500 });
  }
}

/* ===== Slash Command Handler ===== */

async function handleSlashCommand(request, env) {
  if (!(await verifySlackSignature(request, env.SLACK_SIGNING_SECRET))) {
    return new Response("Bad signature", { status: 401 });
  }

  const form = await request.formData();
  const channel_id = form.get("channel_id");
  const user_id = form.get("user_id");
  const text = (form.get("text") || "").trim().toLowerCase();

  if (ALLOWED_CHANNELS && !ALLOWED_CHANNELS.has(channel_id)) {
    return ephemeral("This channel is not enabled for hotdog counting.");
  }

  if (text === "me") {
    const row = await env.DB
      .prepare("SELECT count FROM hotdog_counts WHERE channel_id = ? AND user_id = ?")
      .bind(channel_id, user_id)
      .first();
    const mine = row ? row.count : 0;
    return ephemeral(`🌭 You have posted ${mine} hotdog(s) in this channel`);
  }

  // Default: leaderboard (top 10)
  const top = await env.DB
    .prepare(`
      SELECT user_id, count
      FROM hotdog_counts
      WHERE channel_id = ?
      ORDER BY count DESC
      LIMIT 10
    `)
    .bind(channel_id)
    .all();

  const totalRow = await env.DB
    .prepare("SELECT count FROM channel_totals WHERE channel_id = ?")
    .bind(channel_id)
    .first();

  const total = totalRow ? totalRow.count : 0;
  const lines = (top.results || []).map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.count}`);

  const textResp =
    `🌭 *Hotdog Leaderboard* (channel total: ${total})\n` +
    (lines.length ? lines.join("\n") : "No hotdogs yet 🤷");

  return ephemeral(textResp);
}

/* ===== Helpers ===== */

function countHotdogs(text) {
  if (!text) return 0;
  const patterns = [ /:hotdog:/g, /\u{1F32D}/gu ]; // shortcode + Unicode
  let total = 0;
  for (const re of patterns) {
    const m = text.match(re);
    if (m) total += m.length;
  }
  return total;
}

async function incrementCounts(db, channel_id, user_id, add) {
  // Upsert user count
  await db.prepare(`
    INSERT INTO hotdog_counts (channel_id, user_id, count, updated_at)
    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(channel_id, user_id)
    DO UPDATE SET
      count = count + excluded.count,
      updated_at = excluded.updated_at
  `).bind(channel_id, user_id, add).run();

  // Upsert channel total
  await db.prepare(`
    INSERT INTO channel_totals (channel_id, count, updated_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(channel_id)
    DO UPDATE SET
      count = count + excluded.count,
      updated_at = excluded.updated_at
  `).bind(channel_id, add).run();
}

async function verifySlackSignature(request, signingSecret) {
  try {
    const ts = request.headers.get("X-Slack-Request-Timestamp");
    const sig = request.headers.get("X-Slack-Signature");
    if (!ts || !sig) return false;

    // 5-minute replay window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(ts)) > 60 * 5) return false;

    const body = await request.clone().text();
    const base = `v0:${ts}:${body}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(base));
    const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
    const expected = `v0=${hex}`;

    return timingSafeEqual(expected, sig);
  } catch (e) {
    console.error("Signature verify error:", e);
    return false;
  }
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function ephemeral(text) {
  // Slash command ephemeral response
  return new Response(JSON.stringify({ response_type: "ephemeral", text }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
