# Content Replication Pipeline — Implementation Plan (Approved 2026-09-08)

Goal: VidEdge-style all-in-one faceless video pipeline inside Niche-Scope. Given a source channel (trending / similar / board), replicate a video in that channel's style:
script (exists) → per-scene TTS narration → per-topic online media → ffmpeg render → thumbnail + production board item. Everything local/free; ffmpeg + renders under project folder, not C:/.

## Reuse (already in repo)
- `analyzeChannel()` (lib/aiAnalysis.ts) → `ChannelAnalysis.scripts[]` with `hook/intro/bodySections[]/outro/estimatedDuration`, saved in `channel_scripts` (lib/db.ts SCHEMA lines 163-174).
- AI chat chain: Groq → AiHubMix → OpenRouter → Google AI fallback (`lib/aiAnalysis.ts` `getProviders`, env-var driven).
- Production board: `createProductionItem()` (lib/productionBoard.ts); statuses idea→scripted→recorded→editing→thumbnail→seo→scheduled→published→promoted (+ add "rendered").
- Thumbnail: `generateThumbnail({title, style, niche})` (lib/thumbnailGenerator.ts, AiHubMix, base64).
- Keyword scoring: `overallScore()` (lib/keywordEngine.ts) — optional.
- DB helpers: `run/all/get`, `setSetting/getSetting`; new table = append `CREATE TABLE IF NOT EXISTS` in SCHEMA + add to `BACKUP_TABLES` (lib/backup.ts).
- yt-dlp: `resolveYtdlpPath()` + `searchWithYtdlp()`; new streaming spawn helper needed for downloads.
- node:sqlite (Node 22.5+), tsx scripts, Next 16 webpack dev.

## New files/pieces
1. **DB `replication_runs`** — id, channel_id, channel_title, script_id, script_title, niche, video_format, voice, title, status(planning/tts/media/render/done/failed), stage, progress_json, scenes_json, render_path, thumbnail_path, board_item_id, error, created_at, updated_at. + index(status/channel/created). Add to BACKUP_TABLES.
2. **config fields (lib/config.ts)** — mediaDir (data/media), rendersDir (data/renders), toolsDir, ffmpegPath/ffprobePath (env FFMPEG_PATH/FFPROBE_PATH, default tools/ffmpeg/), voiceStudioBaseUrl (env VOICESTUDIO_URL, default http://127.0.0.1:3900), pixabayApiKey/pexelsApiKey/openverseBaseUrl.
3. **lib/assetConfig.ts** — per-niche stockViable + visualQueries[] + orientation + style; unknown niche default.
4. **lib/mediaScraper.ts** — chain per scene: Openverse (keyless CC web) → Pixabay (key) → Pexels (key) → local library data/media/library/<niche>/ → yt-dlp import (own/CC) → placeholder card. Downloads cached into library.
5. **lib/tts.ts** — Voice Studio OpenAI-compatible `POST /v1/audio/speech` (port auto-detect, voices list) primary; Windows SAPI fallback (System.Speech); Clabeo manual import folder scan.
6. **lib/renderEngine.ts** — ffmpeg/ffprobe spawn (streaming), Ken Burns scene render, concat, 16:9/9:16, output data/renders/<runId>/.
7. **lib/replicationEngine.ts** — orchestrator plan→tts→media→render→finish; single-active-run guard; run CRUD; finish = thumbnail + board item (status "rendered").
8. **API** — POST /api/replicate (start {channelId, scriptId?, format?, voice?}), GET /api/replicate (list), GET /api/replicate/[id] (detail + retry).
9. **/studio page** — runs list, start, live stage progress, render path + board/thumbnail links.
10. **Replicate buttons** — AnalysisModal (home/trending), similar page, production board.
11. **scripts/replicate.ts** — CLI runner; ffmpeg binary download added to scripts/setup.ts → tools/ffmpeg/ffmpeg.exe + ffprobe.exe (project-local, gitignored).

## Media sources decision (user approved "sab sources")
- Openverse keyless (primary web/CC) → Pixabay → Pexels → local → yt-dlp import → placeholder. Keys via env (`PIXABAY_API_KEY`, `PEXELS_API_KEY`) — optional, no blocker.
- Copyright: CC/attribution-ok media only via Openverse; anime screencaps excluded; user local/own footage via yt-dlp import allowed.

## Niche reality
- Strong web+stock: history, science, education, nature/animals, geography, space, travel, cooking, finance, cars, sports, art, tech_ai, asmr, news.
- Stock-heavy (web weak): motivation, fitness, products, beauty_fashion, diy, gaming, kids, family, comedy.
- Weak both (local/import): true_crime, anime-explain.
- Personal (stockViable=false, no auto media): vlogging, reaction/commentary, dance.

## Verify gates
`npm run typecheck` · `npm run test` (vitest) · `npm run build`. Small commits + push to origin/main.