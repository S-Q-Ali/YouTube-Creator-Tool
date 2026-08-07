// Niche-Scope popup: server health + quota + tracked counts from the local API.
const API_BASE = "http://localhost:3000";

const dot = document.getElementById("dot");
const serverText = document.getElementById("serverText");
const body = document.getElementById("body");

function card(label, value) {
  return `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function setServer(on, text) {
  dot.className = "dot " + (on ? "on" : "off");
  serverText.textContent = text;
}

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

async function get(path) {
  const res = await fetch(API_BASE + path, { signal: AbortSignal.timeout(8000) });
  return res.ok ? res.json() : null;
}

async function main() {
  const quota = await get("/api/quota");
  const comp = await get("/api/competitors");
  const auth = await get("/api/auth/status");

  if (!quota) {
    setServer(false, "Server offline");
    body.innerHTML =
      '<div class="card"><div class="label">Niche-Scope server isn’t running</div>' +
      '<div class="value muted">Start it with <b>npm run dev</b> in the project folder, then reopen this popup.</div></div>';
    return;
  }

  setServer(true, "Connected to local server");
  const rows = ["<div class='row'>"];

  if (comp && comp.dashboard) {
    const d = comp.dashboard;
    rows.push(card("Tracked", `${d.videos.length} videos · ${d.channels.length} channels · ${d.keywords.length} keywords`));
  }

  if (quota && quota.quota) {
    const q = quota.quota;
    rows.push(
      `<div class="card"><div class="label">API quota</div><div class="value">` +
        `data ${fmt(q.data.used)}/10k · search ${q.search.used}/100` +
        `</div></div>`
    );
  }

  if (auth) {
    rows.push(card("Own channel", auth.connected ? "Connected (audit ready)" : "Not connected"));
  }

  rows.push("</div>");
  body.innerHTML = rows.join("");
}

main().catch(() => {
  setServer(false, "Server offline");
  body.innerHTML =
    '<div class="card"><div class="label">Niche-Scope server isn’t running</div>' +
    '<div class="value muted">Start it with <b>npm run dev</b>, then reopen this popup.</div></div>';
});
