/**
 * Background poller: snapshots tracked videos/channels/keywords into SQLite so we
 * can compute Views Per Hour, subscriber growth, and keyword score trends over time.
 * Also discovers trending channels every 6 hours.
 *
 * Run alongside `next dev` via `npm run dev:full` (concurrently) or standalone:
 *   npm run poller
 */
import { runAllSnapshots } from "../lib/snapshot";
import { refreshAllTrending } from "../lib/trendingEngine";

const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 3600000);
const trendingIntervalMs = 6 * 60 * 60 * 1000; // 6 hours

async function tick() {
  const summary = await runAllSnapshots();
  console.log(
    `[poller] snapshotted ${summary.videos} videos, ${summary.channels} channels, ${summary.keywords} keywords at ${new Date().toISOString()}`
  );
}

async function tickTrending() {
  try {
    const result = await refreshAllTrending();
    console.log(
      `[poller] trending: discovered ${result.discovered} channels across ${result.niches} niches at ${new Date().toISOString()}`
    );
  } catch (err) {
    console.error("[poller] trending refresh failed:", err);
  }
}

console.log(`[poller] starting (interval ${Math.round(intervalMs / 1000)}s, trending every ${Math.round(trendingIntervalMs / 1000)}s)`);

(async () => {
  await tick();
  await tickTrending();
})();

const timer = setInterval(tick, intervalMs);
const trendingTimer = setInterval(tickTrending, trendingIntervalMs);
timer.unref?.();
trendingTimer.unref?.();

function shutdown() {
  console.log("[poller] shutting down");
  clearInterval(timer);
  clearInterval(trendingTimer);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
