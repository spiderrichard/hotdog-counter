(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

  const el = {
    select: document.getElementById("channelSelect"),
    refresh: document.getElementById("refreshBtn"),
    status: document.getElementById("status"),
    totals: document.getElementById("totals"),
    board: document.getElementById("board"),
    body: document.querySelector("#board tbody"),
  };

  if (!API_BASE) {
    setStatus("Configure API_BASE in docs/config.js");
    return;
  }

  // Utilities
  function setStatus(msg) {
    el.status.textContent = msg || "";
    el.status.style.display = msg ? "block" : "none";
  }
  function setTotals(text) {
    el.totals.textContent = text || "";
  }
  function option(val, text) {
    const o = document.createElement("option");
    o.value = val; o.textContent = text; return o;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadChannels() {
    setStatus("Loading channels…");
    const data = await fetchJSON(`${API_BASE}/api/channels`);
    const results = data.results || [];
    el.select.innerHTML = "";
    for (const ch of results) {
      el.select.appendChild(option(ch.channel_id, `${ch.channel_id} — ${ch.count}`));
    }

    // Respect ?channel= in the URL if present
    const url = new URL(location.href);
    const q = url.searchParams.get("channel");
    if (q && [...el.select.options].some(o => o.value === q)) {
      el.select.value = q;
    }

    if (el.select.value) {
      await loadLeaderboard(el.select.value);
    } else {
      setStatus(results.length ? "Select a channel." : "No channels yet.");
    }
  }

  async function loadLeaderboard(channel_id) {
    setStatus("Loading leaderboard…");
    el.board.hidden = true;
    const data = await fetchJSON(`${API_BASE}/api/leaderboard?channel_id=${encodeURIComponent(channel_id)}`);
    const top = data.top || [];
    el.body.innerHTML = "";
    top.forEach((row, i) => {
      const tr = document.createElement("tr");
      const tdRank = document.createElement("td"); tdRank.textContent = String(i + 1);
      const tdUser = document.createElement("td"); tdUser.textContent = row.user_id; // Slack user ID
      const tdCount = document.createElement("td"); tdCount.textContent = String(row.count);
      tr.append(tdRank, tdUser, tdCount);
      el.body.appendChild(tr);
    });
    setTotals(`Channel total: ${data.total}${data.updated_at ? ` • updated ${new Date(data.updated_at).toLocaleString()}` : ""}`);
    setStatus("");
    el.board.hidden = false;
    // Update URL for sharing
    const url = new URL(location.href);
    url.searchParams.set("channel", channel_id);
    history.replaceState(null, "", url.toString());
  }

  el.select.addEventListener("change", () => {
    const ch = el.select.value;
    if (ch) loadLeaderboard(ch).catch(err => setStatus(err.message));
  });
  el.refresh.addEventListener("click", () => {
    const ch = el.select.value;
    if (ch) loadLeaderboard(ch).catch(err => setStatus(err.message));
  });

  loadChannels().catch(err => setStatus(err.message));
})();

