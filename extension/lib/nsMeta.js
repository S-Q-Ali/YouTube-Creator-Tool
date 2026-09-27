/*
 * Tier 0 grid reader.
 *
 * YouTube already prints a video's views and age on the card, so the grid can
 * paint a reading immediately from that text — no network call, no quota — and
 * then let the server upgrade it with exact values.
 *
 * Loaded before content.js as a classic content script (content scripts are not
 * modules, so it publishes itself on globalThis) and driven in tests by
 * extension/__tests__/nsMeta.test.mjs, which also pins this file's velocity
 * maths to lib/velocity.ts so the instant reading and the upgraded reading can
 * never disagree.
 */
(function (g) {
  const HOUR_MS = 3_600_000;

  const UNIT_HOURS = {
    second: 1 / 3600,
    minute: 1 / 60,
    hour: 1,
    day: 24,
    week: 168,
    month: 720,
    year: 8760
  };

  const SUFFIX_MULTIPLIER = { K: 1e3, M: 1e6, B: 1e9 };

  const VIEWS_RE = /([\d][\d.,]*)\s*([KMB])?\s+views?/i;
  const NO_VIEWS_RE = /no\s+views/i;
  const LIVE_PREFIX = "(?:streamed|premiered|watched|livestreamed)";
  const REL_AGE_RE = new RegExp("(?:" + LIVE_PREFIX + "\\s+)?(\\d+)\\s+(second|minute|hour|day|week|month|year)s?\\s+ago", "i");
  const YESTERDAY_RE = new RegExp(LIVE_PREFIX + "\\s+yesterday|^yesterday", "i");
  const DATE_RE = /\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/;

  function parseViews(text) {
    if (NO_VIEWS_RE.test(text)) return 0;
    const m = text.match(VIEWS_RE);
    if (!m) return null;
    const digits = Number(m[1].replace(/,/g, ""));
    if (!isFinite(digits)) return null;
    const suffix = m[2] ? SUFFIX_MULTIPLIER[m[2].toUpperCase()] : 1;
    return Math.round(digits * suffix);
  }

  function parseAge(text, now) {
    const rel = text.match(REL_AGE_RE);
    if (rel) {
      return { ageHours: Number(rel[1]) * UNIT_HOURS[rel[2].toLowerCase()], ageLabel: rel[0].trim() };
    }
    const yesterday = text.match(YESTERDAY_RE);
    if (yesterday) return { ageHours: 24, ageLabel: yesterday[0].trim() };

    const dated = text.match(DATE_RE);
    if (dated) {
      const published = Date.parse(dated[1] + " " + dated[2] + ", " + dated[3]);
      if (isFinite(published) && now - published > 0) {
        return { ageHours: (now - published) / HOUR_MS, ageLabel: dated[0].trim() };
      }
    }
    return { ageHours: null, ageLabel: null };
  }

  /** Reads the views and age a card already displays. */
  function parse(text, now) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return { views: null, ageHours: null, ageLabel: null };
    const age = parseAge(clean, now == null ? Date.now() : now);
    return { views: parseViews(clean), ageHours: age.ageHours, ageLabel: age.ageLabel };
  }

  /** Same rule as lib/velocity.ts: rate per hour, age floored at one hour. */
  function velocity(facts) {
    if (!facts || facts.views == null || facts.ageHours == null) {
      return { vph: null, vphDay: null, ageHours: 0 };
    }
    const ageHours = Math.max(facts.ageHours, 1);
    const vph = round1(facts.views / ageHours);
    return { vph, vphDay: round1(vph * 24), ageHours };
  }

  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function fmtVph(vph) {
    if (vph == null || !isFinite(vph)) return "";
    return compact(vph) + "/hr";
  }

  function fmtVphDay(vphDay) {
    if (vphDay == null || !isFinite(vphDay)) return "";
    return compact(vphDay) + "/day";
  }

  /** mm:ss or h:mm:ss, the way a card shows a runtime. */
  function fmtDuration(seconds) {
    if (seconds == null || !isFinite(seconds) || seconds <= 0) return "";
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
      : m + ":" + String(s).padStart(2, "0");
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  g.NS_META = { parse, velocity, fmtVph, fmtVphDay, fmtDuration, compact };
})(typeof globalThis !== "undefined" ? globalThis : window);
