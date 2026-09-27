// Niche-Scope popup: server health + quota + tracked counts from the local API.
const API_BASE = "http://localhost:3000";

const dot = document.getElementById("dot");
const serverText = document.getElementById("serverText");
const body = document.getElementById("body");

/* Adapt the panel to the OS theme (light/dark) and follow later flips. */
const themeQuery = window.matchMedia("(prefers-color-scheme: light)");
function applyTheme() {
  const light = themeQuery.matches;
  document.body.setAttribute("data-ns-theme", light ? "light" : "dark");
  document.documentElement.style.colorScheme = light ? "light" : "dark";
}
themeQuery.addEventListener("change", applyTheme);
applyTheme();

function strip(label, value, cls = "") {
  const vcls = cls ? ` ${cls}` : "";
  return `<div class="ns-strip"><span class="k">${label}</span><span class="v${vcls}">${value}</span></div>`;
}

function setServer(on, text) {
  dot.className = "dot " + (on ? "on" : "off");
  serverText.textContent = text;
  serverText.className = on ? "on" : "off";
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

/* ------------------------------ Overlay prefs ------------------------------ */

async function loadPrefs() {
  const res = await chrome.runtime.sendMessage({ type: "prefs:get" });
  if (!res || !res.ok || !res.data) return;
  const p = res.data;
  document.getElementById("showCard").checked = !!p.showCard;
  document.getElementById("showPills").checked = !!p.showPills;
  document.getElementById("showResearch").checked = p.showResearch !== false;
  document.getElementById("showCoach").checked = p.showCoach !== false;
  document.getElementById("dataMode").value = p.dataMode || "line";
  document.getElementById("tileLimit").value = String(p.tileLimit || 60);
  document.getElementById("pillLimit").value = String(p.pillLimit || 24);
}

function savePrefs() {
  chrome.runtime.sendMessage({
    type: "prefs:set",
    prefs: {
      showCard: document.getElementById("showCard").checked,
      showPills: document.getElementById("showPills").checked,
      showResearch: document.getElementById("showResearch").checked,
      showCoach: document.getElementById("showCoach").checked,
      dataMode: document.getElementById("dataMode").value || "line",
      tileLimit: Number(document.getElementById("tileLimit").value) || 60,
      pillLimit: Number(document.getElementById("pillLimit").value) || 24,
    },
  });
}

async function main() {
  const quota = await get("/api/quota");
  const comp = await get("/api/competitors");
  const auth = await get("/api/auth/status");

  if (!quota) {
    setServer(false, "offline");
    body.innerHTML =
      '<p class="err">Server isn\'t running. Start it with <b>npm run dev</b> in the project folder, then reopen this popup.</p>';
    return;
  }

  setServer(true, "online");
  const rows = [];

  if (comp && comp.dashboard) {
    const d = comp.dashboard;
    rows.push(
      strip("tracked", `${d.videos.length} videos, ${d.channels.length} channels, ${d.keywords.length} keywords`)
    );
  }

  if (quota && quota.quota) {
    const q = quota.quota;
    rows.push(
      strip("api quota", `data ${fmt(q.data.used)}/10k, search ${q.search.used}/100`)
    );
  }

  if (auth) {
    rows.push(strip("own channel", auth.connected ? "connected, audit ready" : "not connected"));
  }

  body.innerHTML = rows.length
    ? `<div class="ns-strips">${rows.join("")}</div>`
    : '<p class="muted">No tracked items yet.</p>';
}

document.getElementById("showCard").addEventListener("change", savePrefs);
document.getElementById("showPills").addEventListener("change", savePrefs);
document.getElementById("showResearch").addEventListener("change", savePrefs);
document.getElementById("showCoach").addEventListener("change", savePrefs);
document.getElementById("dataMode").addEventListener("change", savePrefs);
document.getElementById("tileLimit").addEventListener("change", savePrefs);
document.getElementById("pillLimit").addEventListener("change", savePrefs);
loadPrefs();

main().catch(() => {
  setServer(false, "offline");
  body.innerHTML =
    '<p class="err">Server isn\'t running. Start it with <b>npm run dev</b>, then reopen this popup.</p>';
});