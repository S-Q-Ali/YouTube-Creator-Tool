/**
 * Background poller: snapshots tracked videos/channels/keywords into SQLite so we
 * can compute Views Per Hour, subscriber growth, and keyword score trends over time.
 *
 * Run alongside `next dev` via `npm run dev:full` (concurrently) or standalone:
 *   npm run poller
 */
import { runAllSnapshots } from "../lib/snapshot";

const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 3600000);

async function tick() {
  const summary = await runAllSnapshots();
  console.log(
    `[poller] snapshotted ${summary.videos} videos, ${summary.channels} channels, ${summary.keywords} keywords at ${new Date().toISOString()}`
  );
}

console.log(`[poller] starting (interval ${Math.round(intervalMs / 1000)}s)`);
await tick();

const timer = setInterval(tick, intervalMs);
timer.unref?.();

function shutdown() {
  console.log("[poller] shutting down");
  clearInterval(timer);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
