/* Niche-Scope content script: SEO scores + research overlays on YouTube.
 * Fetches happen in the background worker (avoids page CORS).
 * Surfaces: the strip under every grid card, watch-page card (score + tags +
 * AI coach), search-page keyword panel, channel research card. */

/* The component stylesheet used to be duplicated here as two strings - a token
 * block and a component block - because a shadow root does not inherit the
 * page's stylesheets. Both were maintained by hand and drifted from
 * ns-theme.css: the reading was 19px here and 20px there, a strip value 12.5px
 * against 13px, the entrance animation was ns-open here and ns-enter there, and
 * the whole watch card's visual language existed only in this file. Tests
 * recorded what had shipped, so the card's numbers won.
 *
 * Both strings are gone. The shadow roots adopt the real file, and the custom
 * properties arrive for free: this host element carries data-ns-theme and lives
 * in the page, and custom properties inherit across a shadow boundary.
 * extension/tests/theme.test.mjs fails if any of this comes back. */
const THEME_URL = chrome.runtime.getURL("ns-theme.css");

let themeSheet = null;
function loadThemeSheet() {
  if (!themeSheet) {
    themeSheet = fetch(THEME_URL)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.status))))
      .then((text) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        return sheet;
      })
      .catch((err) => {
        // Surfacing a card with no stylesheet at all is better than a second copy
        // of the CSS in here quietly drifting from the original again.
        console.warn("[niche-scope] ns-theme.css unavailable:", err);
        return null;
      });
  }
  return themeSheet;
}

// Started at load, not on first card: by the time anyone opens a watch page the
// sheet has long since arrived, and there is no unstyled flash to catch.
loadThemeSheet();

function api(path, opts) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "api", path, opts }, (res) => resolve(res));
  });
}

const DEFAULT_PREFS = { showCard: true, showResearch: true, showCoach: true, dataMode: "full", tileLimit: 60 };
const DATA_MODES = ["off", "full"];
const PREFS_KEY = "ns:prefs";
let prefs = { ...DEFAULT_PREFS };

/* Reads a stored preference set and repairs anything the current version no
   longer understands, so an old "line" mode becomes today's full block. */
function mergePrefs(stored) {
  const merged = { ...DEFAULT_PREFS, ...(stored || {}) };
  if (!DATA_MODES.includes(merged.dataMode)) merged.dataMode = DEFAULT_PREFS.dataMode;
  return merged;
}

function ensurePrefs() {
  chrome.runtime.sendMessage({ type: "prefs:get" }, (res) => {
    if (res && res.ok && res.data) {
      prefs = mergePrefs(res.data);
      routeOverlays();
      scanHoverIcons();
      scanTiles();
    }
  });
}

function videoIdFromHref(href) {
  return NS_TILES.idFromHref(href, location.href);
}

function gradeOf(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  if (score >= 40) return "E";
  return "F";
}

/* NS_META owns the number and date shapes, so a card line and the panel it
   opens can never spell the same reading two ways. */
function fmt(n) {
  return NS_META.compact(n);
}

function fmtT(n) {
  if (n == null || isNaN(n)) return "—";
  return NS_META.fmtExact(n);
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Count any [data-n] element up to its target once the subtree is mounted. */
function animateNums(root) {
  if (!root) return;
  const reduce = reducedMotion();
  root.querySelectorAll("[data-n]").forEach((el) => {
    const target = parseFloat(el.dataset.n);
    const suffix = el.dataset.s || "";
    if (isNaN(target)) return;
    if (reduce) {
      el.textContent = fmtT(target) + suffix;
      return;
    }
    const start = performance.now();
    const dur = 420;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtT(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function fmtDate(iso) {
  return NS_META.fmtDate(iso) || "—";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function on(str) {
  return /^[A-Za-z0-9]+$/.test(str) ? str : "";
}

/** Segmented signal meter: `count` segments, `score/100` filled. time = cyan fill. */
function segments(score, count, time) {
  const filled = Math.max(0, Math.min(count, Math.round((score / 100) * count)));
  let s = "";
  for (let i = 0; i < count; i++) {
    const onCls = i < filled ? " on" : "";
    const timeCls = i < filled && time ? " on--time" : onCls;
    const delay = i < filled ? ` style="transition-delay:${i * 14}ms"` : "";
    s += `<span class="ns-seg${timeCls}"${delay}></span>`;
  }
  return s;
}

/** Thin meter row: label + meter + reading. */
function meterRow(label, score, time) {
  if (score == null) {
    return `<div class="ns-row"><span class="t">${label}</span><span class="n">—</span></div>`;
  }
  return `<div class="ns-row"><span class="t">${label}</span><span class="m">${segments(score, 8, time)}</span>` +
    `<span class="n">${score}</span></div>`;
}

/* ------------------------------ Shared data cache ------------------------------ */

const lookupMem = new Map();
function lookupVideo(id) {
  if (!lookupMem.has(id)) {
    lookupMem.set(
      id,
      api("/api/videos/lookup", { method: "POST", body: { url: id } }).then((res) =>
        res && res.ok && res.data ? res.data : null
      )
    );
    if (lookupMem.size > 300) lookupMem.clear();
  }
  return lookupMem.get(id);
}

/* ------------------------------ Host mounting ------------------------------ */

const themeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

function currentTheme() {
  return themeQuery && themeQuery.matches ? "light" : "dark";
}

/* Repaint every mounted surface + pill when the OS theme flips. */
function applyTheme() {
  const t = currentTheme();
  document.querySelectorAll("[data-ns-theme]").forEach((el) => el.setAttribute("data-ns-theme", t));
}

if (themeQuery && themeQuery.addEventListener) {
  themeQuery.addEventListener("change", applyTheme);
}

const hosts = {};
function mountHost(name, right, top) {
  if (hosts[name]) return hosts[name];
  const host = document.createElement("div");
  host.className = "ns-host";
  host.setAttribute("data-ns-host", name);
  host.setAttribute("data-ns-theme", currentTheme());
  // position and stacking stay inline on purpose: a content-script stylesheet
  // can lose to a page rule of equal specificity, and a panel that stopped
  // being fixed would be worse than a panel that is slightly too tall. Only the
  // size lives in CSS, where a test can check it - this used to have no size at
  // all.
  host.style.cssText = `position:fixed;z-index:999999;right:${right}px;top:${top}px;`;
  const shadow = host.attachShadow({ mode: "open" });
  const root = document.createElement("div");
  shadow.appendChild(root);
  document.body.appendChild(host);
  // The component CSS is the real stylesheet, adopted into the shadow. The
  // custom properties are not here at all: this host carries data-ns-theme and
  // sits in the page, so ns-theme.css styles it and its tokens inherit inward.
  loadThemeSheet().then((sheet) => {
    if (sheet) shadow.adoptedStyleSheets = [sheet];
  });
  hosts[name] = { host, shadow, root };
  return hosts[name];
}

/*
 * The watch card is not a panel over the page, so it is not mounted like one.
 *
 * The floating panels above are fixed with their own right/top and sized by
 * content.css. This one goes into the list it describes, ahead of the rows it
 * displaces, so that the list is pushed down rather than covered. Three things
 * follow from that and all three are set here rather than left to CSS:
 *
 *   position is stated as static, because the rule that gave the old card its
 *     fixed position was the thing being removed, and a host that kept it
 *     would float over the first video while the space it reserved went
 *     somewhere else
 *   no z-index, because there is nothing to stack above - YouTube's own rows
 *     are ordinary siblings and the card is ahead of them
 *   the two measurements the CSS needs, the list's width and the pitch of two
 *     rows, are read here and handed in as custom properties, so the card
 *     matches the sidebar that is on screen rather than one measured once
 */
function mountInlineCard() {
  // currentLocation reports the route but not the path, and placementFor wants
  // the path, so read it here rather than have the placement guess.
  const placement = NS_PLACEMENT.placementFor({
    doc: document,
    pathname: location.pathname,
    width: window.innerWidth
  });

  if (placement.type === "none") {
    // A card from a previous video, on a page that has no slot for one any
    // more: take it out of the list rather than leave it stranded.
    const stale = hosts.card;
    if (stale) {
      NS_PLACEMENT.unmountStale(placement, stale.host);
      delete hosts.card;
    }
    return null;
  }

  let entry = hosts.card;
  if (!entry) {
    const host = document.createElement("div");
    host.className = "ns-host ns-host--inline";
    host.setAttribute("data-ns-host", "card");
    host.setAttribute("data-ns-theme", currentTheme());
    host.style.cssText = "position:static;display:block;";
    const shadow = host.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    shadow.appendChild(root);
    loadThemeSheet().then((sheet) => {
      if (sheet) shadow.adoptedStyleSheets = [sheet];
    });
    entry = { host, shadow, root, placementType: null, bound: false };
    hosts.card = entry;
  }

  // The reserve is built from the pitch of two rows measured on this list, so
  // the card's height follows the sidebar that is on screen: a narrower
  // sidebar wraps titles and grows taller, and a larger font does too.
  entry.host.style.setProperty("--ns-tile-pitch", `${NS_PLACEMENT.measureTilePitch(placement)}px`);

  // Idempotent: a no-op when the card is already exactly where it belongs, so
  // the re-render path cannot stack a second copy.
  const moved = NS_PLACEMENT.mountAt(placement, entry.host);

  // The two cases put the card in different parents - inside #contents for the
  // up-next list, above the panel for a playlist - so a card that has crossed
  // over needs its shell rebuilt and the close button rebound. A card that was
  // merely re-inserted into the same place does not.
  if (moved && entry.placementType !== null && entry.placementType !== placement.type) {
    entry.root.innerHTML = "";
    entry.bound = false;
  }
  entry.placementType = placement.type;
  if (!entry.bound) {
    bindCardShell(entry);
    // The attribute is the fold contract the stylesheet reads, so it has to be
    // on the host before anything can be measured against it. Setting it here
    // rather than in bindCardShell keeps the state in one place - the same
    // setCardOpen that folds the card also says what unfolded looks like.
    setCardOpen(cardState.open);
  }
  return entry;
}

/**
 * The card's own frame: the title, the fold control, and the body the readings
 * are rendered into. Split out of the mount because crossing between the two
 * placements throws the frame away and has to build it again.
 *
 * The control folds, it does not close. A close button destroyed the host, and
 * `onDomChange` re-mounts the card 800ms after any DOM mutation on a watch page
 * - so closing was a race, and the card came back on the next mutation or did
 * not, and neither was something a reader could rely on. Folding leaves the
 * card mounted, so there is nothing to re-insert. The card has no close button
 * at all, which is also what the reference does. To stop seeing it entirely,
 * the `showCard` preference in the popup is the switch.
 */
function bindCardShell(entry) {
  if (entry.bound) return;
  entry.root.innerHTML =
    '<div class="ns-card ns-surface ns-enter">' +
    '<div class="ns-head"><span class="dot"></span><h1>Niche-Scope</h1>' +
    '<button class="ns-toggle" type="button" aria-expanded="true" aria-controls="ns-card-body">' +
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
    '<path d="M10 6.5 4.5 12 3.8 11.3 8.8 6.3a.85.85 0 0 1 1.2 0l5 5-.7.7z"/>' +
    '</svg><span class="sr-only">Fold the Niche-Scope card</span>' +
    '</button></div>' +
    '<div class="ns-body" id="ns-card-body"><p class="ns-note">Loading…</p></div></div>';

  const toggle = entry.shadow.querySelector(".ns-toggle");
  toggle.addEventListener("click", () => setCardOpen(cardState.open === false));
  entry.bound = true;
}

/**
 * Fold or unfold the card.
 *
 * `data-ns-open` on the host is the whole contract: the stylesheet reads it to
 * drop the body and the two-pitch floor when it is "0". The button's accessible
 * state and name are set here rather than in CSS, because a screen reader is
 * not a stylesheet - a chevron that turned round still announces the same words
 * unless the text changes with it.
 */
function setCardOpen(open) {
  cardState.open = open;
  const m = hosts.card;
  if (!m) return;
  m.host.setAttribute("data-ns-open", open ? "1" : "0");
  const toggle = m.shadow.querySelector(".ns-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const label = toggle.querySelector(".sr-only");
    if (label) label.textContent = open ? "Fold the Niche-Scope card" : "Unfold the Niche-Scope card";
  }
}

function removeHost(name) {
  const h = hosts[name];
  if (h) {
    h.host.remove();
    delete hosts[name];
  }
}

/* ------------------------- Watch-page floating card ------------------------- */

/* `open` is the fold state and belongs to this page's card, not to the video:
   folding is a thing a reader does to a surface, and it survives moving to the
   next video in the sidebar. It is deliberately its own field, and it is the only one
   that decides it: `chartOpen` used to double as the card's expanded flag, so
   two different questions - "is the card folded" and "is the chart showing" -
   shared one attribute, and opening the chart silently unfolded the whole card.
   The chart is part of the card now, so it does not need a flag at all. */
let cardState = { videoId: null, open: true, publishedAt: null, tagsOpen: false, tags: null, coachOpen: false };

function buildCard() {
  const m = mountInlineCard();
  if (!m) return null;
  bindCardShell(m);
  return m;
}

function cardBody() {
  const m = hosts.card;
  return m ? m.shadow.querySelector(".ns-body") : null;
}

function renderCard(data) {
  const s = cardBody();
  if (!s) return;
  if (!data || !data.seo) {
    s.innerHTML =
      '<p class="ns-note">No score for this video. Make sure Niche-Scope is running (npm run dev) and the video is public.</p>';
    return;
  }
  rememberWatchVideo(data);
  /* The chart's age ranges are measured from publication, so the chart needs the
     publish date and needs it as epoch ms - which is not the shape the lookup
     route sends. Parsed once here rather than on every repaint, and a date that
     will not parse becomes null, which the range module reports as "we do not
     know when this was published" instead of treating 1970 as the answer.
     `Date.parse` rather than `new Date(...).getTime()` for the same reason:
     `new Date(null)` is a valid date and `new Date(undefined)` is Invalid Date,
     so an absent value has to be checked before it is handed to a constructor
     that will happily invent a number. */
  const published = data.video ? data.video.publishedAt : null;
  cardState.publishedAt = published ? Date.parse(published) || null : null;

  const total = data.seo.total;
  const life = data.velocity && data.velocity.vph != null ? data.velocity.vph : null;
  const trend = data.vph && data.vph.vph != null ? data.vph.vph : null;
  const spike = life != null && life >= 500;
  const grade = gradeOf(total);
  const chip = total >= 60 ? "ns-chip--live" : total >= 40 ? "" : "ns-chip--dead";
  const rows = [
    `<div class="ns-strip"><span class="k">views</span><span class="v" data-n="${data.video.viewCount}">${fmtT(data.video.viewCount)}</span></div>`
  ];
  if (trend != null) {
    rows.push(
      `<div class="ns-strip"><span class="k">24h trend</span><span class="v ns-time" data-n="${trend}" data-s="/hr">${fmtT(trend)}/hr</span></div>`
    );
  }
  if (data.video.likeCount != null) {
    rows.push(`<div class="ns-strip"><span class="k">likes</span><span class="v">${fmt(data.video.likeCount)}</span></div>`);
  }
  if (data.channelContext && data.channelContext.watchedVideos > 0) {
    rows.push(
      `<div class="ns-strip"><span class="k">ch avg</span><span class="v">${fmt(data.channelContext.channelAvgViews)}</span></div>`
    );
  }
  rows.push(`<div class="ns-strip"><span class="k">posted</span><span class="v ns-time">${fmtDate(data.video.publishedAt)}</span></div>`);
  if (data.channel) {
    rows.push(`<div class="ns-strip"><span class="k">channel</span><span class="v">${fmt(data.channel.subscriberCount)} subs</span></div>`);
  }

  /* The three that lead the card, in the order a reader asks for them: is anyone
     reacting to it, is it doing better than this channel normally does, and is
     it still moving. Engagement is the one that had no home at all - likes and
     comments were both on the card as raw counts, and a count of 2.4k likes
     means nothing on its own without the views it sits against.

     The rate is (likes + comments) / views. Both interaction types count, which
     is the common definition, and it is stated in the tooltip rather than left
     implied. It is not a claim about what any particular product calls
     "engagement" - those differ in the denominator and in whether comments are
     weighted differently, and this one is ours, so it is labelled with what it
     divides by.

     A missing comment count is read as zero comments, which is the ordinary
     reading of a video that has none. A missing like count is not: a video with
     no reaction data is not a video with a 0% engagement rate, so the whole cell
     goes rather than showing a confident wrong number. */
  const stats = [];
  const views = data.video.viewCount || 0;
  const reactions = (data.video.likeCount || 0) + (data.video.commentCount || 0);
  if (views > 0 && (data.video.likeCount != null || data.video.commentCount != null)) {
    const rate = (reactions / views) * 100;
    // Below a tenth of a percent, and the one-decimal places are rounding noise.
    const label = rate < 0.1 ? "<0.1%" : `${rate.toFixed(1)}%`;
    stats.push(
      `<div class="ns-stat" title="Likes and comments divided by views"><span class="k">engagement</span><span class="v" data-n="${rate}">${label}</span></div>`
    );
  } else {
    stats.push(
      `<div class="ns-stat"><span class="k">engagement</span><span class="v ns-na">n/a</span></div>`
    );
  }
  if (data.outlier != null) {
    // Say which average the number is against: videos we stored, or the
    // channel's own lifetime record.
    const basis = data.outlierBasis === "channel" ? "vs channel avg" : "vs avg";
    stats.push(
      `<div class="ns-stat" title="Views as a percentage of ${basis.slice(3)}"><span class="k">outlier</span><span class="v ${data.outlier >= 300 ? "ns-live" : ""}">${fmtT(data.outlier)}%</span></div>`
    );
  } else {
    stats.push(
      `<div class="ns-stat" title="No videos to compare against yet"><span class="k">outlier</span><span class="v ns-na">n/a</span></div>`
    );
  }
  if (life != null) {
    stats.push(
      `<div class="ns-stat" title="Views per hour since this video was published"><span class="k">vph</span><span class="v ${spike ? "ns-live" : ""}" data-n="${life}" data-s="/hr">${fmtT(life)}</span></div>`
    );
  } else {
    stats.push(
      `<div class="ns-stat" title="Needs a publish date to measure a rate"><span class="k">vph</span><span class="v ns-na">n/a</span></div>`
    );
  }

  s.innerHTML = `
    <div class="ns-score">
      <span class="ns-meter">${segments(total, 12)}</span>
      <span class="ns-reading"><span data-n="${total}">${fmtT(total)}</span><span class="ns-chip ${chip}">${grade}</span></span>
    </div>
    <div class="ns-badges">${cardBadges(data)}</div>
    <div class="ns-stats">${stats.join("")}</div>
    <div class="ns-strips">${rows.join("")}</div>
    <p class="ns-foot">actionable ${data.seo.actionablePct}%, performance ${data.seo.performancePct}%</p>
    <div class="ns-chart"></div>
    <div class="ns-actions">
      <button class="ns-btn" type="button" data-a="tags">Tags</button>
      ${prefs.showCoach ? '<button class="ns-btn" type="button" data-a="coach">Ask AI</button>' : ""}
    </div>
    <div class="ns-extras"></div>`;
  animateNums(s);
  bindCardActions();
  // Unconditional. The chart used to sit behind a "Growth" button, which made
  // the most informative part of a scorecard something the reader had to ask
  // for, and meant a video's first week - the only window that says whether it
  // found an audience - was hidden behind a control with an obvious name.
  openChart();
  if (cardState.tagsOpen) openTags();
  if (cardState.coachOpen) openCoach();
}

/*
 * The growth chart, and what the card is honest about when there is none.
 *
 * Three things are worth being straight about here.
 *
 * The first is where the history comes from. This app writes a snapshot row
 * per tracked video, so a video on the watch list has a real series and a
 * video nobody tracked has none. The card says which of those two it found,
 * rather than drawing a flat line that reads like "this video stopped growing"
 * when it means "nobody has been counting".
 *
 * The second is the window. The ranges are measured from the day the video was
 * published, not from today - see lib/chartRange.js for why, and for the two
 * different kinds of "we do not have that" the card can be in. What matters
 * here is that a range is a different cut of readings this card already holds,
 * not a different question to the server, so switching tabs is local and the
 * tabs cannot race each other.
 *
 * The third is the height. The card is never smaller than two rows and is as
 * tall as its content above that, so the list below starts lower by exactly
 * however much the card grew. The chart is part of the card rather than behind a
 * button, so that height is settled when the card is built instead of changing
 * while someone is reading it. The list is pushed by the card's real height, so
 * a taller card simply pushes it further.
 */

const CHART_RANGES = globalThis.NS_CHART_RANGE ? globalThis.NS_CHART_RANGE.RANGES : [];

/** Points needed before a line is worth drawing rather than two dots and a gap.
 *  The number is owned by lib/chartRange.js, which is also the file that promises
 *  no range can be thinner than it; the fallback only covers the library being
 *  absent, which the manifest order should prevent. */
const CHART_MIN_POINTS = globalThis.NS_CHART_RANGE ? globalThis.NS_CHART_RANGE.MIN_POINTS : 3;

/* The whole series, fetched once per video and then re-cut locally for each
   range. It used to be a request per tab, which meant the age ranges - the ones
    measured from publication - could not work: they all need the same readings,
    only counted from a different day. One request for the full window, every
    range cut from it, and switching tabs costs nothing and cannot race. */
let chartState = { videoId: null, range: "7d", data: null, loaded: false };

function chartHost() {
  const m = hosts.card;
  return m ? { m, box: m.shadow.querySelector(".ns-chart"), host: m.host } : null;
}

/**
 * Load the series if it is not already here, then draw the range.
 *
 * There is no close function any more. The chart was behind a button, and a
 * button on a panel that is supposed to be a scorecard made the single most
 * informative thing on it something you had to ask for - and clicking a range
 * tab then re-fetched the same data it already had. It is simply part of the
 * card now, and a video with no history says so in its own space.
 */
function openChart() {
  const c = chartHost();
  if (!c || !c.box) return;
  if (!cardState.videoId) return;

  const want = cardState.videoId;
  const paint = () => {
    const live = chartHost();
    if (live && live.box && cardState.videoId === want) paintChart(live.box, chartState.data, chartState.range);
  };

  if (chartState.videoId === want && chartState.loaded) {
    paint();
    return;
  }

  c.box.innerHTML = '<div class="ns-skeleton"><span></span><span></span></div>';
  api(`/api/videos/history?videoId=${encodeURIComponent(want)}&days=90`)
    .then((res) => {
      // The reader may have moved on while this was in flight.
      if (!cardState.videoId || cardState.videoId !== want) return;
      const data = res && res.ok ? res.data : null;
      chartState = { videoId: want, range: chartState.range || "7d", data, loaded: true };
      paint();
    })
    .catch(() => {
      if (cardState.videoId === want) {
        c.box.innerHTML = '<p class="ns-note ns-note--bad">Could not load the growth history. Is the server running?</p>';
      }
    });
}

/**
 * Draw the range, or say why it cannot be drawn.
 *
 * Two different absences, and the card has to tell them apart. A video nobody
 * tracked has no readings at all. A video that was tracked has readings, but the
 * window its range tab names may start before the ones this app keeps - and
 * drawing the part that exists under a tab that says "1st 7 days" would be a lie
 * told by the control the reader just clicked. The selection hands back whether
 * it is whole, and the note under the chart says which piece is missing.
 */
function paintChart(box, data, rangeKey) {
  const lib = globalThis.NS_CHART_RANGE;
  const ranges = lib ? lib.RANGES : CHART_RANGES;
  // No library, or no ranges in it. One note beats a TypeError that would take
  // the rest of the card down with it.
  if (!lib || !ranges.length) {
    box.innerHTML = '<p class="ns-note">The growth chart is unavailable.</p>';
    return;
  }
  const range = ranges.find((r) => r.key === rangeKey) || ranges[0];
  const tabs = `<div class="ns-chart-tabs" role="group" aria-label="Time range">${ranges
    .map((r) => `<button class="ns-chart-tab" type="button" data-range="${r.key}" aria-pressed="${r.key === range.key}">${r.label}</button>`)
    .join("")}</div>`;

  const wire = () => {
    box.querySelectorAll(".ns-chart-tab").forEach((btn) => {
      btn.onclick = () => {
        const picked = ranges.find((r) => r.key === btn.dataset.range);
        if (!picked) return;
        chartState.range = picked.key;
        // No request: the full series is already in hand and a range is a
        // different cut of it. Anything the reader can do twice does not need
        // the network for the second time.
        const live = chartHost();
        if (live && live.box) paintChart(live.box, chartState.data, picked.key);
      };
    });
  };

  const points = data && Array.isArray(data.points) ? data.points : [];
  if (!points.length) {
    box.innerHTML =
      tabs +
      '<p class="ns-note">No growth history yet. This app records a reading each time it polls, and it only ' +
      'polls videos on your watch list. Add this video to tracking and the line fills in as the days pass.</p>';
    wire();
    return;
  }

  const pick = lib.select(points, {
    range: range.key,
    publishedAt: cardState.publishedAt,
    now: Date.now()
  });
  const shown = pick.points;

  if (shown.length < CHART_MIN_POINTS) {
    // The window exists but is too thin to draw a slope across. Saying so beats
    // two dots and a straight line between them, which reads as a measured
    // trend nobody actually measured.
    box.innerHTML = tabs + `<p class="ns-note">${fmtDateWindow(pick, range)}</p>`;
    wire();
    return;
  }

  const views = shown.map((p) => p.views);
  const first = views[0];
  const last = views[views.length - 1];
  const gained = last - first;
  const perDay = pick.reason ? 0 : Math.round(gained / (shown.length - 1));

  // The path arithmetic lives in lib/chartRange.js, not here, because a flat
  // series is a real case and a special case buried in a template string is a
  // special case nobody finds again.
  const g = lib.geometry(shown, { width: 260, height: 88 });
  const W = g.width;
  const H = g.height;

  const firstDay = new Date(shown[0].t);
  const lastDay = new Date(shown[shown.length - 1].t);
  const fmtDay = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  // Two identical labels under one axis look like a rendering fault rather than
  // a short series, and the readings are bucketed per day, so a range can land
  // both ends on the same date. Printed once rather than twice.
  const fromLabel = fmtDay(firstDay);
  const toLabel = fmtDay(lastDay);
  const axis = fromLabel === toLabel ? `<span>${fromLabel}</span>` : `<span>${fromLabel}</span><span>${toLabel}</span>`;

  const delta = pick.truncated
    ? ""
    : ` <span class="ns-chart-delta">${gained >= 0 ? "+" : ""}${fmtT(gained)} · ${fmtT(perDay)}/day</span>`;

  // The label is the whole chart to a screen reader, so the verb has to match the
  // path: "rising" over a falling series tells the reader the opposite of the
  // picture. A flat series has no span to rise or fall across, so it is named
  // once rather than "unchanged at X to X".
  const trend = g.flat ? "unchanged" : gained > 0 ? "rising" : gained < 0 ? "falling" : "level";
  const ariaLabel = g.flat
    ? `Views unchanged at ${fmtT(first)} across ${shown.length} days`
    : `Views ${trend} from ${fmtT(first)} to ${fmtT(last)} across ${shown.length} days`;

  box.innerHTML =
    tabs +
    `<div class="ns-chart-num">${fmtT(last)}</div>` +
    `<div class="ns-chart-lab">views${delta}</div>` +
    `<svg class="ns-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" ` +
    `aria-label="${ariaLabel}">` +
    `<defs><linearGradient id="ns-chart-gradient" x1="0" y1="0" x2="0" y2="1">` +
    `<stop class="ns-chart-stop-0" offset="0"/><stop class="ns-chart-stop-1" offset="1"/>` +
    `</linearGradient></defs>` +
    (g.area ? `<path class="ns-chart-fill" d="${g.area}" fill="url(#ns-chart-gradient)"/>` : "") +
    `<line class="ns-chart-base" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>` +
    `<path d="${g.line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `</svg>` +
    `<div class="ns-chart-ax">${axis}</div>` +
    (pick.reason ? `<p class="ns-chart-note">${pick.reason}</p>` : "");
  wire();
}

/** The sentence for a window that exists but is too thin to draw. */
function fmtDateWindow(pick, range) {
  if (pick.reason) return pick.reason;
  const held = pick.points.length;
  return `Only ${held} reading${held === 1 ? "" : "s"} in the ${range.label} window - too few to draw a trend. Add this video to tracking and it fills in as the days pass.`;
}

function cardBadges(data) {
  const badges = [];
  const life = data.velocity && data.velocity.vph != null ? data.velocity.vph : null;
  if (life != null && life >= 500) {
    badges.push('<span class="ns-badge bt"><span class="bd"></span>trending</span>');
  }
  if (data.outlier != null && data.outlier >= 300) {
    badges.push(`<span class="ns-badge bo"><span class="bd"></span>${fmtT(data.outlier)}% of avg</span>`);
  }
  return badges.join("");
}

function bindCardActions() {
  const s = cardBody();
  if (!s) return;
  s.querySelectorAll(".ns-btn[data-a]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.a === "tags") {
        cardState.tagsOpen = !cardState.tagsOpen;
        if (cardState.tagsOpen) openTags();
        else closeExtras("tags");
      } else if (btn.dataset.a === "coach") {
        cardState.coachOpen = !cardState.coachOpen;
        if (cardState.coachOpen) openCoach();
        else closeExtras("coach");
      }
      syncActionLabels();
    };
  });
}

function syncActionLabels() {
  const s = cardBody();
  if (!s) return;
  s.querySelectorAll(".ns-btn[data-a]").forEach((btn) => {
    if (btn.dataset.a === "tags") btn.textContent = cardState.tagsOpen ? "Close tags" : "Tags";
    if (btn.dataset.a === "coach") btn.textContent = cardState.coachOpen ? "Close AI" : "Ask AI";
  });
}

function closeExtras(which) {
  const s = cardBody();
  if (!s) return;
  const extra = s.querySelector(`[data-extra="${which}"]`);
  if (extra) extra.remove();
}

function openTags() {
  const s = cardBody();
  if (!s) return;
  if (!cardState.videoId) return;
  const existing = s.querySelector('[data-extra="tags"]');
  if (existing) {
    existing.classList.remove("visually-hidden");
    return;
  }
  const box = document.createElement("div");
  box.dataset.extra = "tags";
  box.innerHTML = '<div class="ns-skeleton"><span></span><span></span><span></span></div>';
  s.querySelector(".ns-extras").appendChild(box);
  if (cardState.tags) {
    renderTags(box, cardState.tags);
    return;
  }
  api(`/api/videos/tags?videoId=${encodeURIComponent(cardState.videoId)}`).then((res) => {
    const data = res && res.ok ? res.data : null;
    if (!data) {
      box.innerHTML = '<p class="ns-note ns-note--bad">Tags unavailable. Check that the server is running.</p>';
      return;
    }
    cardState.tags = data;
    renderTags(box, data);
  });
}

function renderTags(box, data) {
  const tags = data.tags || [];
  const additions = data.additions || [];
  if (tags.length === 0 && additions.length === 0) {
    box.innerHTML = '<p class="ns-note">No public tags on this video.</p>';
    return;
  }
  let html = "";
  if (tags.length) {
    html += `<div class="ns-taghead"><b>Tags</b><span>${tags.length} on video</span></div>` +
      `<div class="ns-tagwrap">${tags.map((t) => tagChip(t.tag, t.score, false)).join("")}</div>`;
  }
  if (additions.length) {
    html += `<div class="ns-taghead"><b>Worth adding</b><span>from your keyword vault</span></div>` +
      `<div class="ns-tagwrap">${additions.map((t) => tagChip(t.tag, t.score, true)).join("")}</div>`;
  }
  html += '<p class="ns-foot">Click a tag to copy it.</p>';
  box.innerHTML = html;
  box.querySelectorAll(".ns-tag").forEach((el) => {
    el.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.tag);
      el.classList.add("copied");
      setTimeout(() => el.classList.remove("copied"), 700);
    });
  });
}

function tagChip(tag, score, isAdd) {
  return `<span class="ns-tag${isAdd ? " ns-add" : ""}" data-tag="${esc(tag)}">${esc(tag)}` +
    `<span class="ns-tagscore">${score == null ? "—" : score}</span></span>`;
}

function openCoach() {
  const s = cardBody();
  if (!s) return;
  if (!cardState.videoId) return;
  const existing = s.querySelector('[data-extra="coach"]');
  if (existing) {
    existing.classList.remove("visually-hidden");
    return;
  }
  const box = document.createElement("div");
  box.dataset.extra = "coach";
  box.innerHTML = `
    <div class="ns-coach">
      <div class="ns-coach-q">
        <textarea rows="2" placeholder="Ask about this video. Example: why is this performing well?"></textarea>
        <button class="ns-btn" type="button" data-a="ask">Ask</button>
      </div>
      <div class="ns-answer"></div>
    </div>`;
  s.querySelector(".ns-extras").appendChild(box);
  const textarea = box.querySelector("textarea");
  const answer = box.querySelector(".ns-answer");
  const askBtn = box.querySelector("[data-a=ask]");
  const ask = () => {
    const query = textarea.value.trim();
    if (!query || askBtn.disabled) return;
    askBtn.disabled = true;
    answer.textContent = "Working on it…";
    api("/api/ai/studio", { method: "POST", body: { action: "coach", videoId: cardState.videoId, query } }).then((res) => {
      askBtn.disabled = false;
      const data = res && res.ok ? res.data : null;
      if (!data || data.error) {
        answer.textContent = data && data.error ? data.error : "Couldn't reach the coach. Is the server running?";
      } else {
        answer.textContent = data.answer;
      }
    });
  };
  askBtn.addEventListener("click", ask);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ask();
  });
}

function showWatchCard(videoId) {
  // A new video means a new series. Keeping the last one's points would draw
  // this video's card with the previous video's growth on it.
  if (cardState.videoId && cardState.videoId !== videoId) {
    chartState = { videoId: null, range: "7d", data: null, loaded: false };
    cardState.publishedAt = null;
  }
  if (!buildCard()) return;
  cardState.videoId = videoId;
  const s = cardBody();
  if (s) s.innerHTML = '<p class="ns-note">Loading.</p>';
  lookupVideo(videoId).then((data) => renderCard(data));
}

/* --------------------- Watch menu: save this thumbnail --------------------- */

/*
 * The download row is placed inside YouTube's own menu, directly under the
 * "Audio and captions" row, by cloning that row so the styling is the site's
 * and not ours. Nothing here assumes a specific build of the menu: if the row
 * is not found the item simply does not appear.
 */
const THUMB_LABEL = "Download thumbnail";
const THUMB_ITEM_CLASS = "ns-thumb-item";
const THUMB_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

let watchThumb = { id: null, title: "", thumbnailUrl: "" };
let thumbLabel = null;
let thumbObserver = null;

function rememberWatchVideo(data) {
  if (!data || !data.video) return;
  watchThumb = {
    id: data.video.videoId,
    title: data.video.title || "",
    thumbnailUrl: data.video.thumbnailUrl || ""
  };
}

function thumbItem() {
  return document.querySelector("." + THUMB_ITEM_CLASS);
}

function removeThumbItem() {
  const item = thumbItem();
  if (item && item.parentNode) item.parentNode.removeChild(item);
  thumbLabel = null;
}

function setThumbState(text) {
  if (!thumbLabel) return;
  thumbLabel.textContent = text || THUMB_LABEL;
  const item = thumbLabel.closest("." + THUMB_ITEM_CLASS);
  if (item) item.classList.toggle("ns-thumb-item--busy", !!text);
}

/* One place that asks the background worker to save an image, so the watch menu
   and the card icon cannot drift apart on payload shape or error reporting. */
function saveThumb(payload, done) {
  chrome.runtime.sendMessage({ type: "thumb:download", urls: payload.urls, filename: payload.filename }, (res) => {
    const bad = chrome.runtime.lastError || !res || !res.ok;
    if (bad) console.warn("[niche-scope] thumbnail download failed:", (res && res.error) || chrome.runtime.lastError);
    done(!bad);
  });
}

function downloadWatchThumb() {
  const id = watchThumb.id || currentVideoId();
  const filename = NS_THUMB.filename(watchThumb.title, id);
  const urls = NS_THUMB.candidates(id, watchThumb.thumbnailUrl);
  if (!filename || urls.length === 0) return;
  setThumbState("Saving...");
  saveThumb({ urls, filename }, (ok) => {
    setThumbState(ok ? "Saved" : "Could not save");
    setTimeout(() => setThumbState(null), 2600);
  });
}

function findAudioCaptionsRow() {
  const rows = Array.from(
    document.querySelectorAll("ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item")
  );
  const index = NS_THUMB.audioCaptionsIndex(rows.map((row) => row.textContent));
  return index === -1 ? null : rows[index];
}

function buildThumbItem(anchor) {
  const item = anchor.cloneNode(true);
  item.classList.add(THUMB_ITEM_CLASS);
  item.classList.remove("ns-thumb-item--busy");
  item.removeAttribute("id");
  item.removeAttribute("aria-checked");
  item.setAttribute("aria-label", THUMB_LABEL);
  item.querySelectorAll("yt-icon, .dropdown-icon, #icon, .ns-thumb-icon").forEach((icon) => icon.remove());

  const labels = item.querySelectorAll(".dropdown-title, .yt-core-attributed-string");
  if (labels.length === 0) return null;
  thumbLabel = labels[0];
  thumbLabel.textContent = THUMB_LABEL;
  for (let i = 1; i < labels.length; i++) labels[i].remove();

  const icon = document.createElement("span");
  icon.className = "ns-thumb-icon";
  icon.innerHTML = THUMB_ICON_SVG;
  item.insertBefore(icon, item.firstChild);

  const run = (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadWatchThumb();
  };
  item.addEventListener("click", run, true);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") run(event);
  }, true);
  return item;
}

function ensureThumbItem() {
  if (currentVideoId() == null) {
    removeThumbItem();
    return;
  }
  if (thumbItem()) return;
  const anchor = findAudioCaptionsRow();
  if (!anchor || !anchor.parentNode) return;
  const item = buildThumbItem(anchor);
  if (item) anchor.parentNode.insertBefore(item, anchor.nextSibling);
}

function watchThumbMenu() {
  if (currentVideoId() == null) {
    if (thumbObserver) {
      thumbObserver.disconnect();
      thumbObserver = null;
    }
    removeThumbItem();
    return;
  }
  if (thumbObserver) return;
  ensureThumbItem();
  thumbObserver = new MutationObserver(() => {
    if (thumbItem()) return;
    clearTimeout(thumbObserver._t);
    thumbObserver._t = setTimeout(ensureThumbItem, 60);
  });
  thumbObserver.observe(document.body, { childList: true, subtree: true });
}

/* ------------------------- Always-on grid data line ------------------------- */

/* Painted on every card of a grid route, then filled in place from
   /api/videos/grid. Where a scan is allowed to look is lib/tiles.js's
   `scanRoot`, which also covers a watch page's up-next list. Which cards
   qualify lives beside it. */

const linedTiles = new WeakSet();
const tileRows = new Map();
let linesPass = 0;

function lineCell(text, className, title) {
  const cell = document.createElement("span");
  cell.className = className;
  cell.textContent = text;
  if (title) cell.title = title;
  return cell;
}

/* An empty span, not a typed bar: the rule is drawn in CSS so it lines up with
   the figures instead of inheriting the row font's pipe metrics. */
function lineSep() {
  return lineCell("", "ns-line-sep");
}

function paintRow(row, cells) {
  while (row.firstChild) row.removeChild(row.firstChild);
  for (let i = 0; i < cells.length; i++) {
    if (i > 0) row.append(lineSep());
    row.append(lineCell(cells[i][0], cells[i][1], cells[i][2]));
  }
}

/* Replace the readings in place; a card never grows, shrinks or reflows twice.
   The wording is decided and tested in lib/lineModel.js; this only paints it. */
function fillLine(row, model) {
  const line = row.line;
  const built = NS_LINE_MODEL.build({ mode: prefs.dataMode, model });

  paintRow(line.children[0], built.ctx);
  paintRow(line.children[1], built.judge);
  line.classList.toggle("ns-line--blank", built.blank);
}

function buildLine() {
  const line = document.createElement("div");
  line.className = "ns-line";
  line.setAttribute("data-ns-theme", currentTheme());
  for (const cls of ["ns-line-ctx", "ns-line-judge"]) {
    const part = document.createElement("div");
    part.className = "ns-line-row " + cls;
    line.append(part);
  }
  return line;
}

/* The strip hangs off the card itself, below the title block, so it reads as an
   annotation on a card rather than another line YouTube wrote. Which cards
   qualify — and the nesting that used to give a video two of them — belongs to
   lib/tiles.js, which is tested against a real grid. */
function scanTiles() {
  if (prefs.dataMode === "off") return;
  const root = NS_TILES.scanRoot(location.pathname, currentVideoId());
  if (!root) return;
  linesPass++;
  const pass = linesPass;
  const budget = prefs.tileLimit || 60;

  NS_TILES.each(root, budget, (tile, id) => {
    if (pass !== linesPass) return false;

    const line = buildLine();
    tile.append(line);
    tile.setAttribute(NS_TILES.MARK, "1");
    linedTiles.add(tile);
    const row = { line, vph: null, subscribers: null, outlier: null, spike: false };
    fillLine(row, row);
    // The same video can appear in more than one slot on a page; every one of
    // those strips has to be filled, not just the first.
    const known = tileRows.get(id);
    if (known) known.push(row);
    else tileRows.set(id, [row]);
    if (gridMem.has(id)) applyModel(id, gridMem.get(id));
    else queueUpgrade(id);
  });
}

/* ---------------- Hover overlay: download this card's thumbnail ---------------- */

/* The icon lives on the card's own hover row, right under the Volume and
   Captions buttons, so it is a card control rather than another annotation. It
   is not part of the strip: it shows in every data mode, it is built from the
   DOM alone, and a press needs no server round trip because the title and the
   image are already in the card. When YouTube has not built that row yet — which
   is most cards, most of the time — the icon places itself in the corner of the
   image instead of leaving a silent gap. */
function cardTitle(tile) {
  const el = tile.querySelector(
    "h3[title], h3 a[title], h3 a, h3, a.ytLockupMetadataViewModelTitle, .ytLockupMetadataViewModelTitle, a#video-title-link, a#video-title"
  );
  if (!el) return "";
  return (el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
}

function cardImage(tile) {
  const img = tile.querySelector("yt-thumbnail-view-model img[src], ytd-thumbnail img[src], img.yt-core-image[src], img[src]");
  return img ? img.getAttribute("src") : "";
}

/* One line per page load, so the next time YouTube renames a card the console
   says which selector went stale instead of leaving a silent gap. */
const hoverProbe = { cards: 0, mounted: 0, missed: 0, boxes: [], reasons: [] };
let hoverProbeLogged = false;

function noteProbe(list, value) {
  if (value && list.indexOf(value) === -1) list.push(value);
}

function mountHoverIcon(tile, id) {
  hoverProbe.cards++;
  if (tile.querySelector("[data-ns-ovl]")) return;

  const box = NS_THUMB.thumbContainer(tile);
  noteProbe(hoverProbe.boxes, box ? box.tagName.toLowerCase() : "");
  // The card, its grid wrapper and the image box itself are all too big to be a
  // neighbour: the icon has to land inside the overlay, not below the image.
  const unsafe = [tile, tile.closest(NS_TILES.HOSTS), box].filter(Boolean);

  const btn = NS_THUMB.buildHoverButton(id, cardTitle(tile), cardImage(tile), (payload) => {
    NS_THUMB.setState(btn, "saving");
    saveThumb(payload, (ok) => {
      NS_THUMB.setState(btn, ok ? "saved" : "failed");
      setTimeout(() => NS_THUMB.setState(btn, null), 2600);
    });
  });

  if (NS_THUMB.attach(btn, tile, unsafe)) {
    hoverProbe.mounted++;
    return;
  }
  hoverProbe.missed++;
  noteProbe(hoverProbe.reasons, box ? "row-unavailable" : "no-image-box");
}

function scanHoverIcons() {
  const root = NS_TILES.scanRoot(location.pathname, currentVideoId());
  if (!root) return;
  NS_TILES.each(root, prefs.tileLimit || 60, (tile, id) => {
    mountHoverIcon(tile, id);
  }, { skipLined: false });

  if (hoverProbeLogged || !hoverProbe.cards) return;
  hoverProbeLogged = true;
  console.debug(
    `[niche-scope] hover icon: cards=${hoverProbe.cards} mounted=${hoverProbe.mounted} ` +
      `missed=${hoverProbe.missed} image-box=[${hoverProbe.boxes.join(", ")}] missed-because=[${hoverProbe.reasons.join(", ")}]`
  );
}

/* --------------------- Tier 1: upgrade the painted line --------------------- */

const gridMem = new Map();
const pendingGrid = new Set();
let gridTimer = null;
let gridInFlight = false;

function queueUpgrade(id) {
  if (gridMem.has(id) || pendingGrid.has(id)) return;
  pendingGrid.add(id);
  clearTimeout(gridTimer);
  gridTimer = setTimeout(flushUpgrades, 250);
}

/** A line already on screen is never re-scanned, so a failed batch has to be
    requeued here or those cards stay on Tier 0 readings forever. */
const MAX_GRID_ATTEMPTS = 3;
let gridAttempts = 0;

function requeueGrid(ids) {
  for (const id of ids) if (!gridMem.has(id)) pendingGrid.add(id);
}

/* One request per scroll settle, capped at the endpoint's 50-id page. */
async function flushUpgrades() {
  if (gridInFlight || pendingGrid.size === 0) return;
  const ids = [...pendingGrid].slice(0, 50);
  ids.forEach((id) => pendingGrid.delete(id));
  gridInFlight = true;
  try {
    const res = await api("/api/videos/grid", { method: "POST", body: { ids } });
    const rows = res && res.ok && res.data ? res.data.rows : null;
    if (rows && rows.length > 0) {
      gridAttempts = 0;
      for (const data of rows) storeRow(data.id, data);
      const answered = new Set(rows.map((r) => r.id));
      requeueGrid(ids.filter((id) => !answered.has(id)));
    } else {
      gridAttempts++;
      requeueGrid(ids);
    }
  } catch {
    gridAttempts++;
    requeueGrid(ids);
  }
  gridInFlight = false;
  if (pendingGrid.size === 0) return;
  if (gridAttempts < MAX_GRID_ATTEMPTS) setTimeout(flushUpgrades, 2500);
  else pendingGrid.clear();
}

/* The strip renders four numbers, so the grid model carries only those. Views,
   duration, publish date and the 24h trend belong to YouTube's own row — reading
   them again here would only duplicate what the page already shows. */
function storeRow(id, data) {
  const model = {
    vph: data.velocity && data.velocity.vph != null ? data.velocity.vph : null,
    subscribers: data.subscribers,
    outlier: data.outlier,
    spike: !!data.spike
  };
  gridMem.set(id, model);
  if (gridMem.size > 400) gridMem.clear();
  applyModel(id, model);
}

function applyModel(id, model) {
  const rows = tileRows.get(id);
  if (!rows) return;
  for (const row of rows) {
    row.vph = model.vph;
    row.subscribers = model.subscribers;
    row.outlier = model.outlier;
    row.spike = model.spike;
    fillLine(row, model);
  }
}

/* ------------------------- Search keyword panel ------------------------- */

let searchState = null;

function showSearchPanel(term) {
  const shadow = mountHost("search", 16, 288);
  shadow.root.innerHTML = `
    <div class="ns-surface ns-enter" style="width:232px;padding:10px 12px 8px;">
      <div class="ns-head"><span class="dot"></span><h1>Keyword scope</h1>
        <button class="close" type="button">×</button></div>
      <p class="ns-note">${esc(term)}</p>
      <div class="ns-body"><div class="ns-skeleton"><span></span><span></span><span></span></div></div>
    </div>`;
  shadow.shadow.querySelector(".close").addEventListener("click", () => {
    removeHost("search");
    searchState = { ...(searchState || {}), closed: true };
  });
  const body = shadow.shadow.querySelector(".ns-body");

  const render = (r) => {
    const k = r.results && r.results[0];
    let html = "";
    if (k) {
      html += meterRow("demand", k.demandScore);
      if (k.scored && k.competitionScore > 0) {
        html += meterRow("competition", k.competitionScore, true);
      } else {
        html += `<div class="ns-row"><span class="t">competition</span><span class="n">—</span></div>`;
      }
      html += meterRow("opportunity", k.overallScore);
    }
    if (r.questions && r.questions.length) {
      html += `<div class="ns-section-title">People ask</div>` +
        `<div class="ns-chips">${r.questions.slice(0, 5).map((q) => questionChip(q)).join("")}</div>`;
    }
    if (r.matchingTerms && r.matchingTerms.length) {
      html += `<div class="ns-section-title">Related terms</div>` +
        `<div class="ns-chips">${r.matchingTerms.slice(0, 8).map((t) => `<button class="ns-chipbtn" type="button" data-term="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
    }
    if (r.results && r.results.length > 1) {
      html += `<div class="ns-section-title">Top suggestions</div>` +
        `<div class="ns-list">${r.results.slice(1, 5).map((x) => topSug(x)).join("")}</div>`;
    }
    html += `<div class="ns-actions">`;
    html += k && !(k.scored && k.competitionScore > 0)
      ? `<button class="ns-btn" type="button" data-a="rank">Score competition</button>`
      : "";
    html += `<button class="ns-btn" type="button" data-a="trend">Trending in niche</button></div>`;
    html += `<div class="ns-trend"></div>`;
    body.innerHTML = html;
    body.querySelectorAll(".ns-chipbtn[data-term]").forEach((b) => {
      b.addEventListener("click", () => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.assign(`/results?search_query=${encodeURIComponent(b.dataset.term)}`);
      });
    });
    const rankBtn = body.querySelector("[data-a=rank]");
    if (rankBtn) {
      rankBtn.addEventListener("click", () => {
        rankBtn.disabled = true;
        rankBtn.textContent = "Scoring…";
        api("/api/keywords/research", { method: "POST", body: { seed: term, rankTop: 3, maxResults: 10 } }).then((res) => {
          render(res && res.ok ? res.data : {});
        });
      });
    }
    const trendBtn = body.querySelector("[data-a=trend]");
    if (trendBtn) {
      trendBtn.addEventListener("click", () => {
        trendBtn.disabled = true;
        trendBtn.textContent = "Reading…";
        const trendBox = body.querySelector(".ns-trend");
        trendBox.innerHTML = '<div class="ns-skeleton"><span></span><span></span><span></span></div>';
        api("/api/videos/trending-search", { method: "POST", body: { term, maxResults: 8 } }).then((res) => {
          const d = res && res.ok ? res.data : null;
          if (!d || (d.items && d.items.length === 0)) {
            trendBox.innerHTML = `<p class="ns-note ns-note--bad">${d && d.notice ? esc(d.notice) : "No trending videos found."}</p>`;
            return;
          }
          trendBox.innerHTML = `<div class="ns-section-title">Trending in niche</div><div class="ns-list">` +
            d.items.map((it) => trendItem(it)).join("") + `</div>`;
        });
      });
    }
  };

  const key = searchState && searchState.term === term ? searchState : null;
  if (key && key.data) {
    render(key.data);
  } else {
    api(`/api/keywords/${encodeURIComponent(term)}`).then((res) => {
      if (res && res.ok && res.data && res.data.keyword) {
        const data = { seed: term, results: [res.data.keyword], questions: [], matchingTerms: [] };
        searchState = { term, data };
        render(data);
      } else {
        api("/api/keywords/research", { method: "POST", body: { seed: term, rankTop: 0, maxResults: 10 } }).then((r2) => {
          const d = r2 && r2.ok ? r2.data : null;
          if (!d) {
            body.innerHTML = '<p class="ns-note ns-note--bad">Research unavailable right now. Is the server running?</p>';
            return;
          }
          searchState = { term, data: d };
          render(d);
        });
      }
    });
  }
}

function questionChip(q) {
  return q && q.length < 40 ? `<span class="ns-chipbtn ns-q">${esc(q)}</span>` : "";
}

function topSug(x) {
  return `<a class="ns-item" href="/results?search_query=${encodeURIComponent(x.term)}" target="_blank" rel="noopener">` +
    `<span class="ns-item-title">${esc(x.displayTerm || x.term)}</span><span class="ns-item-v">${x.demandScore || 0}</span></a>`;
}

function trendItem(it) {
  const views = it.viewCount != null ? fmt(it.viewCount) : null;
  return `<a class="ns-item" href="/watch?v=${on(it.videoId)}" target="_blank" rel="noopener">` +
    `<span class="ns-item-title">${esc(it.title)}</span>` +
    `${views ? `<span class="ns-item-v">${views}</span>` : ""}</a>`;
}

/* ------------------------- Channel research card ------------------------- */

function showChannelCard(ref) {
  const shadow = mountHost("channel", 16, 64);
  shadow.root.innerHTML = `
    <div class="ns-surface ns-enter" style="width:232px;padding:10px 12px 8px;">
      <div class="ns-head"><span class="dot"></span><h1>Channel signal</h1>
        <button class="close" type="button">×</button></div>
      <div class="ns-body"><div class="ns-skeleton"><span></span><span></span><span></span></div></div>
    </div>`;
  shadow.shadow.querySelector(".close").addEventListener("click", () => removeHost("channel"));
  const body = shadow.shadow.querySelector(".ns-body");

  api("/api/channels/lookup", { method: "POST", body: { url: ref } }).then((res) => {
    const d = res && res.ok ? res.data : null;
    if (!d || !d.channel) {
      body.innerHTML = `<p class="ns-note">${res && res.data && res.data.error ? esc(res.data.error) : "No data for this channel right now."}</p>`;
      return;
    }
    const c = d.channel;
    const vids = d.recentVideos || [];
    const avg = vids.length ? vids.reduce((a, b) => a + b.viewCount, 0) / vids.length : null;
    const winners = avg ? vids.filter((v) => v.viewCount > avg * 1.5).sort((a, b) => b.viewCount - a.viewCount).slice(0, 3) : [];
    const cadence = cadenceOf(vids);

    let rows = "";
    if (c.subscriberCount != null) rows += stripRow("subs", fmt(c.subscriberCount));
    if (c.viewCount != null) rows += stripRow("views", fmt(c.viewCount));
    if (c.videoCount != null) rows += stripRow("uploads", fmt(c.videoCount));
    if (cadence) rows += stripRow("cadence", cadence);
    if (avg) rows += stripRow("avg views", fmt(Math.round(avg)));

    let html = `<div class="ns-strips">${rows}</div>`;
    if (winners.length) {
      html += `<div class="ns-section-title">Winners</div><div class="ns-list">` +
        winners.map((v) => `<a class="ns-item" href="/watch?v=${on(v.videoId)}" target="_blank" rel="noopener">` +
          `<span class="ns-item-title">${esc(v.title)}</span>` +
          `<span class="ns-item-v">${fmt(v.viewCount)}</span></a>`).join("") +
        `</div>`;
    }
    if (vids.length) {
      const last = vids.reduce((a, b) => (a.publishedAt >= b.publishedAt ? a : b));
      rows = "";
      html += `<div class="ns-section-title">Latest upload</div><div class="ns-list">` +
        `<a class="ns-item" href="/watch?v=${on(last.videoId)}" target="_blank" rel="noopener">` +
        `<span class="ns-item-title">${esc(last.title)}</span>` +
        `<span class="ns-item-v">${fmt(last.viewCount)}</span></a></div>`;
    }
    body.innerHTML = html;
  });
}

function stripRow(k, v) {
  return `<div class="ns-strip"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

function cadenceOf(vids) {
  if (vids.length < 2) return null;
  const sorted = [...vids].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const seen = sorted.slice(0, 10);
  let sum = 0;
  let n = 0;
  for (let i = 1; i < seen.length; i++) {
    const d1 = new Date(seen[i - 1].publishedAt).getTime();
    const d2 = new Date(seen[i].publishedAt).getTime();
    if (d1 > d2) {
      sum += (d1 - d2) / 86400000;
      n++;
    }
  }
  if (!n) return null;
  const days = Math.max(0, Math.round(sum / n));
  return days <= 1 ? "daily" : days <= 4 ? "every ~" + days + " days" : "roughly weekly";
}

/* ------------------------------- Routing ------------------------------- */

function currentVideoId() {
  return videoIdFromHref(location.href);
}

function currentLocation() {
  // This script owns www.youtube.com research overlays. Studio gets its own
  // script (Phase C); other subdomains (tv/music) get nothing.
  if (location.hostname !== "www.youtube.com") return { type: "none" };
  const id = currentVideoId();
  if (id) return { type: "watch", id };
  const p = location.pathname;
  if (p.startsWith("/results")) {
    const term = new URLSearchParams(location.search).get("search_query") || "";
    return { type: "results", term };
  }
  if (/^\/@[\w.\-]+/.test(p) || /^\/channel\//.test(p)) {
    return { type: "channel", ref: p };
  }
  return { type: "none" };
}

function routeOverlays() {
  const loc = currentLocation();
  switch (loc.type) {
    case "watch":
      removeHost("search");
      removeHost("channel");
      if (prefs.showCard) showWatchCard(loc.id);
      else removeHost("card");
      watchThumbMenu();
      break;
    case "results":
      removeHost("card");
      removeHost("channel");
      if (prefs.showResearch && !(searchState && searchState.closed)) showSearchPanel(loc.term);
      else removeHost("search");
      break;
    case "channel":
      removeHost("card");
      removeHost("search");
      if (prefs.showResearch) showChannelCard(loc.ref);
      else removeHost("channel");
      break;
    default:
      removeHost("card");
      removeHost("search");
      removeHost("channel");
      break;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[PREFS_KEY]) return;
  const before = prefs.dataMode;
  prefs = mergePrefs(changes[PREFS_KEY].newValue);
  routeOverlays();
  // Density and card data both change what a line says, so redraw every line
  // rather than guess which preference the change was about. The hover icon is
  // not part of the strip, so it stays where it is.
  if (prefs.dataMode !== before) {
    stripLines();
    scanTiles();
  }
});

function stripLines() {
  tileRows.clear();
  document.querySelectorAll(".ns-line").forEach((line) => {
    const tile = line.parentNode;
    if (!tile) return;
    // The mark has to go with the strip, or the next pass would skip every
    // card as already annotated and nothing would ever come back.
    tile.removeAttribute(NS_TILES.MARK);
    tile.removeChild(line);
  });
}

function onDomChange() {
  // YouTube rebuilds the sidebar whenever the page settles, which takes the
  // card out of the list with it. Put it back before scanning, so the strips
  // land on a list that already has its card. mountInlineCard is a no-op when
  // the card is already in the right place, so this costs nothing on a pass
  // that did not touch the list.
  if (prefs.showCard && currentLocation().type === "watch") mountInlineCard();
  scanHoverIcons();
  scanTiles();
}

let observer = null;
function init() {
  console.log("[niche-scope] content script ready:", location.href);
  ensurePrefs();
  routeOverlays();
  scanHoverIcons();
  scanTiles();

  observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(onDomChange, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Re-route when navigating via the History API.
let lastHref = location.href;
function watchUrl() {
  if (location.href !== lastHref) {
    lastHref = location.href;
    routeOverlays();
    // A new video is a new title to name the file after.
    watchThumb = { id: currentVideoId(), title: watchThumb.title, thumbnailUrl: "" };
  }
  requestAnimationFrame(watchUrl);
}

init();
watchUrl();
