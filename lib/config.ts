import path from "node:path";

const cwd = process.cwd();

export const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  dataDir: process.env.DATABASE_DIR
    ? path.resolve(cwd, process.env.DATABASE_DIR)
    : path.join(cwd, "data"),
  get dbPath() {
    return path.join(this.dataDir, "niche-scope.db");
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  autocompleteBaseUrl:
    "https://suggestqueries.google.com/complete/search",
  autocompleteTimeoutMs: 10_000,
  apiBaseUrl: "https://www.googleapis.com/youtube/v3",
  analyticsBaseUrl: "https://youtubeanalytics.googleapis.com/v2",
  videoCacheTtlMs: 60 * 60 * 1000, // 1 hour
  channelCacheTtlMs: 60 * 60 * 1000, // 1 hour
  keywordCacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  snapshotDedupeMs: 10 * 60 * 1000, // don't double-snapshot within 10 min
};

export function requireApiKey(): string {
  if (!config.youtubeApiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Create a Google Cloud project, enable the YouTube Data API v3, and put the key in .env.local (see .env.example)."
    );
  }
  return config.youtubeApiKey;
}
