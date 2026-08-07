/**
 * One-shot setup helper. Run with:  npm run setup
 * - checks Node version + deps
 * - creates .env.local from .env.example if missing
 * - verifies the SQLite database/schema initializes
 * - reports which credentials are configured
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { all } from "../lib/db";

const root = path.resolve(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");

function check(label: string, ok: boolean, detail = "") {
  const icon = ok ? "✓" : "✗";
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readEnv(): Record<string, string> {
  if (!fs.existsSync(envLocal)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] !== "NEXT_PUBLIC_APP_URL") out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  console.log("Niche-Scope setup\n");

  console.log("1. Runtime");
  const nodeMajor = Number(process.version.replace("v", "").split(".")[0]);
  check("Node", nodeMajor >= 20, process.version);
  check("node:sqlite available", typeof (await import("node:sqlite")).DatabaseSync === "function");

  console.log("\n2. Dependencies");
  try {
    execSync("npm.cmd ls next react --depth=0", { stdio: "pipe" });
    check("next/react installed", true);
  } catch {
    console.log("  ! Run `npm install` first.");
    process.exitCode = 1;
    return;
  }

  console.log("\n3. Environment file");
  if (fs.existsSync(envLocal)) {
    check(".env.local present", true);
  } else if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envLocal);
    check(".env.local created from .env.example", true, "edit it with your keys");
  } else {
    check(".env.example missing", false);
    process.exitCode = 1;
    return;
  }

  const env = readEnv();

  console.log("\n4. Credentials");
  const keyOk = check("YOUTUBE_API_KEY", Boolean(env.YOUTUBE_API_KEY));
  if (!keyOk) {
    console.log("      Needed for scorecards, rankings, and channel lookups.");
    console.log("      Get one: https://console.cloud.google.com -> APIs & Services -> Credentials -> API key");
  }
  const oauthOk = check("Google OAuth (client id + secret)", Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET));
  if (!oauthOk) {
    console.log("      Only needed for the own-channel audit (/audit).");
  }

  console.log("\n5. Database");
  try {
    all("SELECT count(*) FROM settings");
    check("SQLite schema initialized", true, path.join(root, "data"));
  } catch (err) {
    check("SQLite schema initialized", false, err instanceof Error ? err.message : "error");
    process.exitCode = 1;
    return;
  }

  console.log("\nDone. Start it with:");
  console.log("  npm run dev         # web server at http://localhost:3000");
  console.log("  npm run dev:full    # web server + background poller");
  if (!keyOk || !oauthOk) {
    console.log("\nNext: paste your keys into .env.local, then restart the dev server.");
  }
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exitCode = 1;
});
