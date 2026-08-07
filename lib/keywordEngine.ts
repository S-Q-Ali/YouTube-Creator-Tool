import { fetchSuggestions, QUESTION_WORDS } from "./autocomplete";
import { searchVideos, fetchVideos } from "./youtubeClient";
import { all, get, now, run } from "./db";
import type { KeywordRow, ScoredVideo } from "./types";

export type CompetitionLabel = "Low" | "Medium" | "High";

export interface KeywordResult {
  term: string;
  displayTerm: string;
  demandScore: number;
  competitionScore: number;
  competitionLabel: CompetitionLabel;
  overallScore: number;
  source: string;
  scored: boolean;
}

export interface ResearchOutput {
  seed: string;
  results: KeywordResult[];
  relatedCount: number;
  matchingTerms: string[];
  questions: string[];
  ranked: number;
  truncated: boolean;
}

export interface ResearchOptions {
  hl?: string;
  gl?: string;
  rankTop?: number;
  maxResults?: number;
  forceRefresh?: boolean;
}

/** Next 16 passes some route params raw (URL-encoded). Normalize for DB lookups. */
export function decodeTerm(raw: string): string {
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

interface RawKeywordRow {
  term: string;
  display_term: string;
  score: number;
  demand_score: number;
  competition_score: number;
  competition_label: string;
  source: string;
  language: string | null;
  country: string | null;
  first_seen: number;
  last_checked: number;
}

function toKeywordRow(r: RawKeywordRow): KeywordRow {
  return {
    term: r.term,
    displayTerm: r.display_term,
    score: r.score,
    demandScore: r.demand_score,
    competitionScore: r.competition_score,
    competitionLabel: r.competition_label as CompetitionLabel,
    source: r.source,
    language: r.language ?? "",
    country: r.country ?? "",
    firstSeen: r.first_seen,
    lastChecked: r.last_checked,
  };
}

/**
 * Transparent scoring:
 *  - demand: 0-100 from YouTube autocomplete ordering (earlier suggestion = more-searched).
 *    Max rank base across all expansion branches + small frequency bonus.
 *  - competition: 0-100 from live search results of the top candidates
 *    (share of videos with 100k+ views + log-scaled average of top-10 views).
 *  - overall ("opportunity"): (demand * (100 - competition)) / 100.
 */
export function computeDemand(rankEntries: { rank: number; count: number }[]): number {
  if (rankEntries.length === 0) return 0;
  const best = Math.max(...rankEntries.map((e) => Math.max(0, 100 - e.rank * 7)));
  const occurrences = rankEntries.length;
  const demand = best + (occurrences - 1) * 3;
  return Math.max(0, Math.min(100, Math.round(demand)));
}

export function competitionFromViews(views: number[]): { score: number; label: CompetitionLabel } {
  if (views.length === 0) return { score: 0, label: "Low" };
  const strong = views.filter((v) => v >= 100_000).length;
  const strongShare = strong / views.length;
  const avgTop10 = views.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, views.length);
  const logAvg = Math.log10(Math.max(1, avgTop10)) / 9; // 0..1 for 1..1e9 views
  const score = Math.round((strongShare * 0.5 + logAvg * 0.5) * 100);
  const label: CompetitionLabel = score < 33 ? "Low" : score < 66 ? "Medium" : "High";
  return { score: Math.max(0, Math.min(100, score)), label };
}

export function competitionLabel(score: number): CompetitionLabel {
  return score < 33 ? "Low" : score < 66 ? "Medium" : "High";
}

export function overallScore(demand: number, competition: number): number {
  return Math.max(0, Math.min(100, Math.round((demand * (100 - competition)) / 100)));
}

interface KeywordUpsert {
  term: string;
  displayTerm: string;
  score: number;
  demandScore: number;
  competitionScore: number;
  competitionLabel: string;
  source: string;
  language?: string | null;
  country?: string | null;
  firstSeen?: number;
  lastChecked: number;
}

function upsertKeyword(k: KeywordUpsert) {
  const existing = get<{ first_seen: number }>("SELECT first_seen FROM keywords WHERE term = $term", { term: k.term });
  run(
    `INSERT INTO keywords (term, display_term, score, demand_score, competition_score, competition_label, source, language, country, first_seen, last_checked)
     VALUES ($term, $display_term, $score, $demand_score, $competition_score, $competition_label, $source, $language, $country, $first_seen, $last_checked)
     ON CONFLICT(term) DO UPDATE SET
       display_term = $display_term, score = $score, demand_score = $demand_score,
       competition_score = $competition_score, competition_label = $competition_label,
       source = $source, language = $language, country = $country, last_checked = $last_checked`,
    {
      term: k.term,
      display_term: k.displayTerm,
      score: k.score,
      demand_score: k.demandScore,
      competition_score: k.competitionScore,
      competition_label: k.competitionLabel,
      source: k.source,
      language: k.language ?? null,
      country: k.country ?? null,
      first_seen: k.firstSeen ?? existing?.first_seen ?? now(),
      last_checked: k.lastChecked,
    }
  );
  run(
    `INSERT OR IGNORE INTO keyword_snapshots (term, ts, demand_score, competition_score, score)
     VALUES ($term, $ts, $demand_score, $competition_score, $score)`,
    {
      term: k.term,
      ts: now(),
      demand_score: k.demandScore,
      competition_score: k.competitionScore,
      score: k.score,
    }
  );
}

/**
 * Rank a single keyword against YouTube search and compute real competition.
 * Stores rankings for the term. Uses the 100/day search.list bucket — cached 24h.
 */
export async function rankKeyword(term: string, opts: ResearchOptions = {}): Promise<KeywordResult | null> {
  const existing = get<RawKeywordRow>(
    "SELECT * FROM keywords WHERE term = $term AND last_checked >= $cutoff",
    { term, cutoff: now() - 24 * 60 * 60 * 1000 }
  );
  if (existing && existing.competition_score > 0 && !opts.forceRefresh) {
    return {
      term: existing.term,
      displayTerm: existing.display_term,
      demandScore: existing.demand_score,
      competitionScore: existing.competition_score,
      competitionLabel: existing.competition_label as CompetitionLabel,
      overallScore: existing.score,
      source: existing.source,
      scored: true,
    };
  }

  const search = await searchVideos(term, { maxResults: 50 });
  const ids = search.items.map((i) => i.videoId);
  const videos = await fetchVideos(ids);

  const views = videos
    .map((v) => v.viewCount)
    .sort((a, b) => b - a);
  const comp = competitionFromViews(views);

  const demand = existing?.demand_score ?? computeDemand([{ rank: 0, count: 1 }]);
  const score = overallScore(demand, comp.score);

  upsertKeyword({
    term,
    displayTerm: existing?.display_term ?? term,
    score,
    demandScore: demand,
    competitionScore: comp.score,
    competitionLabel: comp.label,
    source: existing?.source ?? "search",
    language: existing?.language ?? opts.hl,
    country: existing?.country ?? opts.gl,
    firstSeen: existing?.first_seen,
    lastChecked: now(),
  });

  const ts = now();
  for (let i = 0; i < search.items.length; i++) {
    run(
      `INSERT OR REPLACE INTO rankings (term, video_id, position, ts)
       VALUES ($term, $video_id, $position, $ts)`,
      { term, video_id: search.items[i].videoId, position: i + 1, ts }
    );
  }

  return {
    term,
    displayTerm: existing?.display_term ?? term,
    demandScore: demand,
    competitionScore: comp.score,
    competitionLabel: comp.label,
    overallScore: score,
    source: existing?.source ?? "search",
    scored: true,
  };
}

/**
 * Full research flow for a seed:
 *  1. collect suggestions from autocomplete (direct + a-z + question-word expansion)
 *  2. derive demand scores cheaply for every term
 *  3. rank the top `rankTop` candidates via YouTube search for real competition
 *  4. persist everything; return results sorted by overall score
 */
export async function researchKeyword(seed: string, opts: ResearchOptions = {}): Promise<ResearchOutput> {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "us";
  const rankTop = Math.min(opts.rankTop ?? 5, 10);
  const maxResults = Math.min(opts.maxResults ?? 60, 200);

  const rankByTerm = new Map<string, { rank: number; count: number }[]>();
  const rawPool = new Set<string>();
  const recordList = (terms: string[]) =>
    terms.forEach((t, idx) => {
      const key = t.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key) return;
      rawPool.add(t);
      const arr = rankByTerm.get(key) ?? [];
      arr.push({ rank: idx, count: 1 });
      rankByTerm.set(key, arr);
    });

  recordList(await fetchSuggestions(seed, { hl, gl }));
  for (const prefix of [..."abcdefghijklmnopqrstuvwxyz", ..."0123456789"]) {
    recordList(await fetchSuggestions(`${seed} ${prefix}`, { hl, gl }));
  }
  for (const qw of QUESTION_WORDS) {
    recordList(await fetchSuggestions(`${qw} ${seed}`, { hl, gl }));
  }

  const suggestionPool = new Set<string>([seed, ...rawPool]);

  const results: KeywordResult[] = [];
  for (const term of suggestionPool) {
    const norm = term.toLowerCase().replace(/\s+/g, " ").trim();
    if (!norm) continue;
    const entries = rankByTerm.get(norm) ?? [{ rank: 99, count: 1 }];
    const demandScore = computeDemand(entries);
    const source = norm === seed.toLowerCase() ? "seed" : "autocomplete";
    results.push({
      term: norm,
      displayTerm: term,
      demandScore,
      competitionScore: 0,
      competitionLabel: "Low",
      overallScore: demandScore,
      source,
      scored: false,
    });
  }

  results.sort((a, b) => b.demandScore - a.demandScore);
  const toRank = results.slice(0, rankTop).map((r) => r.term);

  const rankedTerms = new Map<string, KeywordResult>();
  for (const term of toRank) {
    try {
      const ranked = await rankKeyword(term, { hl, gl });
      if (ranked) rankedTerms.set(term, ranked);
    } catch {
      // individual ranking failures shouldn't kill the whole research run
    }
  }

  const merged = results.map((r) => rankedTerms.get(r.term) ?? r);

  const matchingTerms = merged
    .filter((r) => r.term !== seed.toLowerCase() && r.term.includes(seed.toLowerCase()))
    .slice(0, 20)
    .map((r) => r.displayTerm);

  const questions = merged
    .filter((r) => QUESTION_WORDS.some((qw) => r.term.startsWith(`${qw} `)))
    .slice(0, 20)
    .map((r) => r.displayTerm);

  for (const r of merged) {
    upsertKeyword({
      term: r.term,
      displayTerm: r.displayTerm,
      score: r.overallScore,
      demandScore: r.demandScore,
      competitionScore: r.competitionScore,
      competitionLabel: r.competitionLabel,
      source: r.source,
      language: hl,
      country: gl,
      lastChecked: now(),
    });
  }

  const sorted = [...merged].sort((a, b) => b.overallScore - a.overallScore);
  const truncated = sorted.length > maxResults;

  return {
    seed,
    results: truncated ? sorted.slice(0, maxResults) : sorted,
    relatedCount: sorted.length,
    matchingTerms,
    questions,
    ranked: toRank.length,
    truncated,
  };
}

export function getCachedKeywords(search?: string, limit = 100): KeywordRow[] {
  const rows = search
    ? all<RawKeywordRow>(
        `SELECT * FROM keywords WHERE term LIKE $q ORDER BY score DESC, last_checked DESC LIMIT $limit`,
        { q: `%${search.toLowerCase()}%`, limit }
      )
    : all<RawKeywordRow>("SELECT * FROM keywords ORDER BY score DESC, last_checked DESC LIMIT $limit", { limit });
  return rows.map(toKeywordRow);
}

export function getKeyword(term: string): KeywordRow | undefined {
  const row = get<RawKeywordRow>("SELECT * FROM keywords WHERE term = $term", { term });
  return row ? toKeywordRow(row) : undefined;
}

export function getKeywordSnapshots(term: string): { ts: number; score: number | null; demand: number | null; competition: number | null }[] {
  return all<{ ts: number; score: number | null; demand: number | null; competition: number | null }>(
    `SELECT ts, score, demand_score AS demand, competition_score AS competition
     FROM keyword_snapshots WHERE term = $term ORDER BY ts ASC`,
    { term }
  );
}

export function getRankedVideos(term: string): ScoredVideo[] {
  const rows = all<{
    video_id: string;
    position: number;
    title: string;
    published_at: string;
    view_count: number;
    like_count: number | null;
    comment_count: number | null;
    channel_id: string;
  }>(
    `SELECT r.video_id, r.position, v.title, v.published_at, v.view_count, v.like_count, v.comment_count, v.channel_id
     FROM rankings r
     JOIN videos v ON v.video_id = r.video_id
     WHERE r.term = $term
     ORDER BY r.position ASC`,
    { term }
  );
  return rows.map((r) => ({
    videoId: r.video_id,
    title: r.title,
    channelTitle: "",
    publishedAt: r.published_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
  }));
}
