/**
 * Run the replication pipeline from the terminal.
 *
 *   npm run replicate -- <scriptId> [--niche X] [--format longform|shortform]
 *       [--channel CHANNEL_ID] [--channel-title "Title"] [--voice VOICE] [--title "Run title"]
 *
 * Loads .env.local (if present) so the same secrets used by the web app are applied.
 */
import fs from "node:fs";
import path from "node:path";
import { startReplication, runReplication, getReplicationRun } from "../lib/replicationEngine";
import { get } from "../lib/db";

const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv.length > idx + 1) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  loadEnvLocal();
  const scriptIdArg = process.argv[2];
  if (!scriptIdArg || /^--/.test(scriptIdArg)) {
    console.error("Usage: npm run replicate -- <scriptId> [--niche X] [--format longform|shortform] [--channel ID] [--channel-title T] [--voice V] [--title T]");
    process.exit(1);
  }
  const scriptId = Number(scriptIdArg);
  if (!Number.isFinite(scriptId)) {
    console.error(`Invalid scriptId: ${scriptIdArg}`);
    process.exit(1);
  }

  const format = (arg("format") ?? "longform") as "longform" | "shortform";
  let channelId = arg("channel") ?? "";
  let channelTitle = arg("channel-title") ?? "";
  let title = arg("title") ?? "";

  if (!channelId || !title) {
    const script = getReplicationRunStubScript(scriptId);
    if (!script) {
      console.error(`Script #${scriptId} not found.`);
      process.exit(1);
    }
    channelId = channelId || script.channelId;
    channelTitle = channelTitle || script.channelTitle;
    title = title || script.title;
  }

  console.log(`Replicating script #${scriptId}:`);
  console.log(`  channel : ${channelId} (${channelTitle})`);
  console.log(`  title   : ${title}`);
  console.log(`  niche   : ${arg("niche") ?? "auto"}`);
  console.log(`  format  : ${format}`);
  console.log(`  voice   : ${arg("voice") ?? "auto (Voice Studio default)"}`);
  console.log("");

  const run = await startReplication({
    channelId,
    channelTitle,
    scriptId,
    niche: arg("niche") ?? "",
    videoFormat: format,
    voice: arg("voice") ?? "",
    runTitle: title,
  });

  const timer = setInterval(() => {
    const r = getReplicationRun(run.id);
    if (!r) return;
    let stage = r.stage;
    if (r.status === "running") {
      try {
        const progress = JSON.parse(r.progress_json || "{}");
        if (progress.stage) stage = progress.stage;
      } catch {
        /* ignore */
      }
    }
    console.log(`[${new Date().toLocaleTimeString()}] status=${r.status} stage=${stage}`);
  }, 4000);

  let final = run;
  try {
    final = await runReplication(run.id);
  } catch (err) {
    const failed = getReplicationRun(run.id);
    if (failed) {
      console.error(`\nReplication failed: ${failed.error || String(err)}`);
    } else {
      console.error(`\nReplication failed before persistence: ${err instanceof Error ? err.message : err}`);
    }
    clearInterval(timer);
    process.exit(1);
  }
  clearInterval(timer);

  console.log("\nDone.");
  console.log(`  status  : ${final.status} (${final.stage})`);
  if (final.render_path) console.log(`  video   : ${final.render_path}`);
  if (final.thumbnail_path) console.log(`  thumb   : ${final.thumbnail_path}`);
  if (final.board_item_id) console.log(`  board   : ${final.board_item_id}`);
  if (final.script_title) console.log(`  title   : ${final.script_title}`);
}

function getReplicationRunStubScript(scriptId: number): { channelId: string; channelTitle: string; title: string } | undefined {
  const row = get<{ channel_id: string; channel_title: string | null; script_title: string | null }>(
    `SELECT channel_scripts.channel_id AS channel_id,
            channels.title AS channel_title,
            channel_scripts.script_title AS script_title
     FROM channel_scripts
     LEFT JOIN channels ON channels.channel_id = channel_scripts.channel_id
     WHERE channel_scripts.id = $id`,
    { $id: scriptId }
  );
  if (!row) return undefined;
  return {
    channelId: row.channel_id ?? "",
    channelTitle: row.channel_title ?? "",
    title: row.script_title ?? "",
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});