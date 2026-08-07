import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { config } from "./config";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  term TEXT PRIMARY KEY,
  display_term TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  demand_score INTEGER NOT NULL DEFAULT 0,
  competition_score INTEGER NOT NULL DEFAULT 0,
  competition_label TEXT NOT NULL DEFAULT 'Low',
  source TEXT NOT NULL DEFAULT 'autocomplete',
  language TEXT,
  country TEXT,
  first_seen INTEGER NOT NULL,
  last_checked INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_snapshots (
  term TEXT NOT NULL,
  ts INTEGER NOT NULL,
  demand_score INTEGER,
  competition_score INTEGER,
  score INTEGER,
  PRIMARY KEY (term, ts)
);

CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  custom_url TEXT,
  country TEXT,
  published_at TEXT,
  subscriber_count INTEGER,
  video_count INTEGER,
  view_count INTEGER,
  channel_tags TEXT,
  topic_categories TEXT,
  last_fetched INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_snapshots (
  channel_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  subscriber_count INTEGER,
  video_count INTEGER,
  view_count INTEGER,
  PRIMARY KEY (channel_id, ts)
);

CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY,
  channel_id TEXT,
  title TEXT,
  description TEXT,
  published_at TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  default_language TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  tags TEXT,
  category_id TEXT,
  last_fetched INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS video_snapshots (
  video_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  PRIMARY KEY (video_id, ts)
);

CREATE TABLE IF NOT EXISTS tracked_items (
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  label TEXT,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (kind, ref_id)
);

CREATE TABLE IF NOT EXISTS rankings (
  term TEXT NOT NULL,
  video_id TEXT NOT NULL,
  position INTEGER,
  ts INTEGER NOT NULL,
  PRIMARY KEY (term, video_id, ts)
);

CREATE INDEX IF NOT EXISTS idx_video_snapshots_video ON video_snapshots(video_id);
CREATE INDEX IF NOT EXISTS idx_channel_snapshots_channel ON channel_snapshots(channel_id);
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_term ON keyword_snapshots(term);
CREATE INDEX IF NOT EXISTS idx_rankings_term ON rankings(term);
`;

let db: DatabaseSync | null = null;

function open(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

/** node:sqlite may return BigInt for values beyond Number.MAX_SAFE_INTEGER. Normalize. */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

export interface DbQueryOptions {
  params?: Record<string, string | number | null>;
}

export function run(sql: string, params: Record<string, string | number | null> = {}) {
  const d = open();
  return d.prepare(sql).run(params);
}

export function all<T>(sql: string, params: Record<string, string | number | null> = {}): T[] {
  const d = open();
  const rows = d.prepare(sql).all(params);
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as T);
}

export function get<T>(sql: string, params: Record<string, string | number | null> = {}): T | undefined {
  const d = open();
  const row = d.prepare(sql).get(params) as Record<string, unknown> | undefined;
  return row ? (normalizeRow(row) as T) : undefined;
}

export function setSetting(key: string, value: string) {
  run(
    "INSERT INTO settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = $value",
    { key, value }
  );
}

export function getSetting(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = $key", { key })?.value;
}

export function now(): number {
  return Date.now();
}
