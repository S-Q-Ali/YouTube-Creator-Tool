import { getAiCache, setAiCache } from "./aiCache";

export type StudioAction = "titles" | "descriptions" | "tags" | "magicfill" | "coach" | "audit" | "ideas";

export interface StudioParams {
  action: StudioAction;
  videoId?: string;
  channelId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  transcript?: string;
  query?: string;
  context?: string;
  keyword?: string;
}

export interface OptimizeScore {
  score: number;
  title: number;
  description: number;
  tags: number;
  note: string;
}

export interface TitleCandidate {
  title: string;
  score: number;
}

export interface DescriptionCandidate {
  description: string;
  score: number;
}

export interface TagCandidate {
  tag: string;
  score: number;
}

export interface IdeaCandidate {
  title: string;
  hook: string;
  contentType: "video" | "short" | "series";
  estimatedViews: "high" | "medium" | "low";
}

export type StudioResult =
  | { action: "titles"; candidates: TitleCandidate[]; optimize: OptimizeScore }
  | { action: "descriptions"; candidates: DescriptionCandidate[]; optimize: OptimizeScore }
  | { action: "tags"; current: TagCandidate[]; additions: TagCandidate[]; optimize: OptimizeScore }
  | { action: "magicfill"; title: string; description: string; tags: string[]; optimize: OptimizeScore }
  | { action: "coach"; answer: string }
  | { action: "audit"; summary: string }
  | { action: "ideas"; ideas: IdeaCandidate[] };

const THINK_TAG_END = String.fromCharCode(60, 47, 116, 104, 105, 110, 107, 62);

function stripThinkingTags(content: string): string {
  const idx = content.lastIndexOf(THINK_TAG_END);
  return idx !== -1 ? content.substring(idx + THINK_TAG_END.length).trim() : content;
}

interface Provider {
  name: string;
  baseUrl: string;
  model: string;
  formatRequest: (prompt: string, temperature: number) => RequestInit;
  parseResponse: (res: Response) => Promise<string>;
}

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
      formatRequest: (prompt: string, temperature: number) => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature,
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) throw new Error(`Groq error: ${data.error.message || JSON.stringify(data.error)}`);
        return stripThinkingTags(data.choices?.[0]?.message?.content || "");
      },
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemma-4-31b-it:free",
      formatRequest: (prompt: string, temperature: number) => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://niche-scope.local",
          "X-Title": "Niche-Scope Studio AI",
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it:free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature,
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
        return data.choices?.[0]?.message?.content || "";
      },
    });
  }

  return providers;
}

async function callLLM(prompt: string, temperature = 0.7): Promise<string> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error("No AI providers configured. Add GROQ_API_KEY or OPENROUTER_API_KEY to .env.local");
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 5000;
        console.log(`Retrying ${provider.name} in ${delay / 1000}s (attempt ${attempt + 1}/3)...`);
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const res = await fetch(`${provider.baseUrl}/chat/completions`, {
          ...provider.formatRequest(prompt, temperature),
          signal: AbortSignal.timeout(120000),
        });
        if (res.status === 429) {
          console.log(`${provider.name} rate limited, retrying...`);
          continue;
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => "Unknown error");
          throw new Error(`${provider.name} API error ${res.status}: ${errText}`);
        }
        const text = await provider.parseResponse(res);
        if (!text.trim()) throw new Error(`${provider.name} returned empty content`);
        return text;
      } catch (err) {
        console.error(`Provider ${provider.name} failed:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw lastError || new Error("All AI providers failed");
}

function parseJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response was not valid JSON");
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
}

function asObjectArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : [];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function trim(s: string | undefined, max: number): string {
  return (s || "").trim().slice(0, max);
}

/* ------------------------------ Heuristic scoring ------------------------------ */

const POWER_WORDS = new Set([
  "secret", "hack", "easy", "fast", "best", "top", "ultimate", "guide", "tutorial",
  "amazing", "incredible", "surprising", "shocking", "breakdown", "revealed",
  "proven", "powerful", "mistake", "avoid", "stop", "beginner", "expert", "simple",
]);

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function includesKeyword(haystack: string, keyword: string | undefined): boolean {
  if (!keyword) return true;
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

export function scoreTitle(title: string, keyword?: string): number {
  if (!title.trim()) return 0;
  const len = title.length;
  let score = 40;
  if (len >= 30 && len <= 70) score += 20;
  else if ((len >= 20 && len < 30) || (len > 70 && len <= 85)) score += 10;
  if (includesKeyword(title, keyword)) score += 25;
  if ([...POWER_WORDS].some((w) => title.toLowerCase().includes(w))) score += 10;
  if (/\d/.test(title)) score += 5;
  return clamp(score);
}

export function scoreDescription(description: string, keyword?: string): number {
  if (!description.trim()) return 0;
  const words = countWords(description);
  let score = 35;
  if (words >= 150 && words <= 250) score += 20;
  else if (words >= 80 && words <= 500) score += 10;
  if (includesKeyword(description, keyword)) score += 15;
  if (description.includes("#")) score += 5;
  if (/https?:\/\//.test(description)) score += 5;
  if (words >= 280) score -= 10;
  return clamp(score);
}

export function scoreTag(tag: string, keyword?: string, title?: string): number {
  const t = tag.toLowerCase().trim();
  if (!t) return 0;
  const words = countWords(t);
  let score = 30;
  if (words >= 1 && words <= 3) score += 30;
  else if (words <= 5) score += 15;
  if (t.length >= 4) score += 10;
  if (keyword && t.includes(keyword.toLowerCase())) score += 30;
  if (title) {
    const titleTokens = title.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
    if (titleTokens.some((w) => t.includes(w))) score += 15;
  }
  return clamp(score);
}

export function computeOptimizeScore(o: { title?: string; description?: string; tags?: string[]; keyword?: string }): OptimizeScore {
  const title = (o.title || "").trim();
  const description = (o.description || "").trim();
  const tags = (o.tags || []).filter(Boolean);

  const titleScore = scoreTitle(title, o.keyword);
  const descScore = scoreDescription(description, o.keyword);
  const tagScore = tags.length
    ? Math.round(tags.slice(0, 10).reduce((sum, t) => sum + scoreTag(t, o.keyword, title), 0) / Math.min(10, tags.length))
    : 0;

  const score = clamp(Math.round(titleScore * 0.4 + descScore * 0.3 + tagScore * 0.3));
  const note = titleScore >= 70
    ? "Title is in good shape."
    : tags.length === 0
      ? "Add tags to lift the score."
      : "Add the keyword to your title and description.";

  return { score, title: titleScore, description: descScore, tags: tagScore, note };
}

/* --------------------------------- Prompts --------------------------------- */

function contentContext(p: StudioParams): string {
  const parts = [];
  if (p.transcript) parts.push(`Video transcript (first ${p.transcript.length} chars):\n${p.transcript}`);
  if (p.description && p.description.trim() && p.action !== "descriptions") {
    parts.push(`Current description:\n${p.description}`);
  }
  if ((p.tags || []).length) parts.push(`Current tags: ${(p.tags || []).join(", ")}`);
  return parts.join("\n\n");
}

function buildPrompt(p: StudioParams): { prompt: string; temperature: number } {
  const kw = trim(p.keyword, 60);
  const ctx = contentContext(p);
  const topic = p.context
    ? `\nFocus area / channel: ${p.context}`
    : p.title
      ? `\nCurrent title: ${p.title}`
      : "";

  switch (p.action) {
    case "titles":
      return {
        prompt: `You are a YouTube SEO strategist. Generate exactly 5 video title options for the content below.
Return ONLY valid JSON: {"titles":[{"title":"...","rationale":"..."}]}
Requirements:
- Varied angle, not five versions of the same phrasing
- Under 70 characters where possible
- Natural sentence case, no clickbait lies
- Include the focus keyword when it fits naturally
Content:\n${ctx || "(no content provided)"}${topic}
Focus keyword: ${kw || "(none)"}`, temperature: 0.8,
      };
    case "descriptions":
      return {
        prompt: `You are a YouTube SEO strategist. Generate exactly 3 description variants (150-250 words) for the video.
Return ONLY valid JSON: {"descriptions":["DESC1","DESC2","DESC3"]}
Requirements:
- Each variant is complete, structured text with a hook, keyword-rich body, clear section breaks
- Uses the focus keyword naturally a few times
- Plain text, no hashtag spam (max 3 relevant hashtags at the end)
Content context:\n${ctx || "(no content provided)"}${topic}
Focus keyword: ${kw || "(none)"}`, temperature: 0.8,
      };
    case "tags":
      return {
        prompt: `You are a YouTube SEO strategist. Recommend tags for a video.
Return ONLY valid JSON: {"keep":["...","..."],"add":["...","..."]}
- "keep": tags worth keeping from the current list
- "add": 8-15 new tags you recommend
- Tags are 1-3 words, specific, simple spelling; include one or two common misspellings
- Base suggestions on the transcript, title, and description, not just on the current tags
Current tags: ${(p.tags || []).join(", ") || "(none)"}
Content:\n${ctx || "(no content provided)"}${topic}
Focus keyword: ${kw || "(none)"}`, temperature: 0.5,
      };
    case "magicfill":
      return {
        prompt: `You are a YouTube upload assistant. Produce optimized title, description, and tags for a video.
Return ONLY valid JSON: {"title":"...","description":"..." ,"tags":["..."]}
- Title: one strong option, under 70 characters, focus keyword if it fits
- Description: 150-250 words, keyword-rich, max 3 hashtags at the end
- Tags: 15-30 tags, 1-3 words each
Content:\n${ctx || "(no content provided)"}${topic}
Focus keyword: ${kw || "(none)"}`, temperature: 0.6,
      };
    case "coach":
      return {
        prompt: `You are an experienced YouTube growth coach. Answer the creator's question about this video.\n\nChannel/video context: ${p.context || "(none)"}\n\nTranscript:\n${trim(p.transcript, 6000) || "(no transcript available)"}\n\nQuestion: ${p.query || "Summarize this video and explain why it works."}\n\nAnswer in plain text, 3-6 short paragraphs, specific and actionable. No JSON.`,
        temperature: 0.5,
      };
    case "audit":
      return {
        prompt: `You are a YouTube channel auditor. Produce a concise audit summary for this channel. Return ONLY valid JSON: {"summary":"...","issues":["..."],"nextActions":["..."]}
The summary is 3-5 sentences; issues are 3-6 concrete problems; nextActions are 3-6 prioritized fixes.
Channel data: ${p.context || "(none)"}`, temperature: 0.5,
      };
    case "ideas":
      return {
        prompt: `You are a YouTube trend researcher. Generate 5 video topic ideas for a channel. Return ONLY valid JSON: {"ideas":[{"title":"...","hook":"...","contentType":"video|short|series","estimatedViews":"high|medium|low"}]}
Content types: longform video, short, or series. Hook is the first 2 sentences of the 30-second opening.
Channel / niche context: ${p.context || "(none)"}${topic}`, temperature: 0.8,
      };
  }
}

/* ------------------------------ Result parsing ------------------------------ */

function toStudioResult(action: StudioAction, text: string, p: StudioParams): StudioResult {
  const kw = trim(p.keyword, 60);
  switch (action) {
    case "titles": {
      const raw = parseJson(text);
      const candidates = asObjectArray(raw.titles).slice(0, 5).map((x) => ({
        title: asString(x.title),
        score: scoreTitle(asString(x.title), kw),
      }));
      return { action, candidates, optimize: computeOptimizeScore({ title: p.title, description: p.description, tags: p.tags, keyword: kw }) };
    }
    case "descriptions": {
      const raw = parseJson(text);
      const candidates = asStringArray(raw.descriptions).slice(0, 3).map((d) => ({
        description: d,
        score: scoreDescription(d, kw),
      }));
      return { action, candidates, optimize: computeOptimizeScore({ title: p.title, description: p.description, tags: p.tags, keyword: kw }) };
    }
    case "tags": {
      const raw = parseJson(text);
      const current = (p.tags || []).map((t) => ({ tag: t, score: scoreTag(t, kw, p.title) }));
      const additions = asStringArray(raw.add).slice(0, 15).map((t) => ({ tag: t, score: scoreTag(t, kw, p.title) }));
      return { action, current, additions, optimize: computeOptimizeScore({ title: p.title, description: p.description, tags: p.tags, keyword: kw }) };
    }
    case "magicfill": {
      const raw = parseJson(text);
      const title = asString(raw.title);
      const description = asString(raw.description);
      const tags = asStringArray(raw.tags).slice(0, 30);
      return { action, title, description, tags, optimize: computeOptimizeScore({ title, description, tags, keyword: kw }) };
    }
    case "coach":
      return { action, answer: text.trim() };
    case "audit": {
      const raw = parseJson(text);
      const summary = asString(raw.summary);
      const issues = asStringArray(raw.issues);
      const nextActions = asStringArray(raw.nextActions);
      return { action, summary: [summary, ...issues.map((i) => `- ${i}`), ...nextActions.map((n) => `Next: ${n}`)].join("\n") };
    }
    case "ideas": {
      const raw = parseJson(text);
      const ideas = asObjectArray(raw.ideas).slice(0, 5).map((x) => ({
        title: asString(x.title),
        hook: asString(x.hook),
        contentType: (["video", "short", "series"].includes(asString(x.contentType)) ? asString(x.contentType) : "video") as IdeaCandidate["contentType"],
        estimatedViews: (["high", "medium", "low"].includes(asString(x.estimatedViews)) ? asString(x.estimatedViews) : "medium") as IdeaCandidate["estimatedViews"],
      }));
      return { action, ideas };
    }
  }
}

/* --------------------------------- Runner --------------------------------- */

export async function runStudio(p: StudioParams): Promise<StudioResult> {
  const inputsKey = JSON.stringify({
    title: trim(p.title, 300),
    description: trim(p.description, 1200),
    tags: (p.tags || []).slice(0, 30).map((t) => trim(t, 50)),
    transcript: trim(p.transcript, 8000),
    keyword: trim(p.keyword, 60),
    query: trim(p.query, 300),
    context: trim(p.context, 400),
    videoId: p.videoId,
    channelId: p.channelId,
  });

  const cached = getAiCache(p.action, inputsKey);
  if (cached) {
    return toStudioResult(p.action, cached, p);
  }

  const { prompt, temperature } = buildPrompt(p);
  const text = await callLLM(prompt, temperature);
  const result = toStudioResult(p.action, text, p);

  // Only cache structured (JSON) results; plain-text coaching changes per query.
  const jsonAction = p.action !== "coach";
  if (jsonAction) setAiCache(p.action, inputsKey, text);
  return result;
}