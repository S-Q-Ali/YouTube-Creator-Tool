import { all, get, run } from "./db";
import type { ChannelInfo, VideoInfo } from "./types";

interface AIProvider {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  formatRequest: (prompt: string) => RequestInit;
  parseResponse: (res: Response) => Promise<string>;
}

interface ChannelAnalysis {
  strategy: {
    contentType: string[];
    postingSchedule: string;
    thumbnailStyle: string;
    titleFormula: string;
    tagStrategy: string[];
    uniqueSellingPoints: string[];
  };
  contentIdeas: Array<{
    title: string;
    description: string;
    contentType: "video" | "short" | "series";
    estimatedViews: "high" | "medium" | "low";
    difficulty: "easy" | "medium" | "hard";
  }>;
  scripts: Array<{
    title: string;
    hook: string;
    intro: string;
    bodySections: string[];
    outro: string;
    estimatedDuration: number;
  }>;
  growthBlueprint: {
    "30day": { goals: string[]; actions: string[]; metrics: string[] };
    "60day": { goals: string[]; actions: string[]; metrics: string[] };
    "90day": { goals: string[]; actions: string[]; metrics: string[] };
  };
}

const THINK_TAG_END = String.fromCharCode(60, 47, 116, 104, 105, 110, 107, 62);

function stripThinkingTags(content: string): string {
  const idx = content.lastIndexOf(THINK_TAG_END);
  if (idx !== -1) {
    return content.substring(idx + THINK_TAG_END.length).trim();
  }
  return content;
}

function getProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
      maxTokens: 4096,
      formatRequest: (prompt: string) => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) {
          throw new Error(`Groq error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        const content = data.choices?.[0]?.message?.content || "";
        return stripThinkingTags(content);
      },
    });
  }

  if (process.env.AIHUBMIX_API_KEY) {
    providers.push({
      name: "aihubmix",
      apiKey: process.env.AIHUBMIX_API_KEY,
      baseUrl: "https://aihubmix.com/v1",
      model: "qwen3.7-plus-preview-free",
      maxTokens: 4096,
      formatRequest: (prompt: string) => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AIHUBMIX_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen3.7-plus-preview-free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) {
          throw new Error(`AiHubMix error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        return stripThinkingTags(data.choices?.[0]?.message?.content || "");
      },
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemma-4-31b-it:free",
      maxTokens: 4096,
      formatRequest: (prompt: string) => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://niche-scope.local",
          "X-Title": "Niche-Scope YouTube Research",
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it:free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) {
          throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        return data.choices?.[0]?.message?.content || "";
      },
    });
  }

  if (process.env.GOOGLE_AI_API_KEY) {
    providers.push({
      name: "google",
      apiKey: process.env.GOOGLE_AI_API_KEY,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.0-flash",
      maxTokens: 8192,
      formatRequest: (prompt: string) => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        }),
      }),
      parseResponse: async (res: Response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.error) {
          throw new Error(`Google AI error: ${JSON.stringify(data.error)}`);
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      },
    });
  }

  return providers;
}

function buildAnalysisPrompt(channel: ChannelInfo, videos: VideoInfo[]): string {
  const videoList = videos.slice(0, 5).map(
    (v) => `- "${v.title}" | Views: ${v.viewCount?.toLocaleString()} | Likes: ${v.likeCount?.toLocaleString() || "N/A"}`
  ).join("\n");

  return `Analyze this YouTube channel and return ONLY valid JSON (no markdown).

Channel: ${channel.title}
Subscribers: ${channel.subscriberCount?.toLocaleString()}
Views: ${channel.viewCount?.toLocaleString()}
Videos: ${channel.videoCount}
Description: ${(channel.description || "").substring(0, 300)}

Top videos:
${videoList}

Return this JSON structure:
{"strategy":{"contentType":["types"],"postingSchedule":"freq","thumbnailStyle":"style","titleFormula":"formula","tagStrategy":["tags"],"uniqueSellingPoints":["points"]},"contentIdeas":[{"title":"title","description":"desc","contentType":"video","estimatedViews":"high","difficulty":"medium"}],"scripts":[{"title":"title","hook":"hook","intro":"intro","bodySections":["s1"],"outro":"outro","estimatedDuration":600}],"growthBlueprint":{"30day":{"goals":["g"],"actions":["a"],"metrics":["m"]},"60day":{"goals":["g"],"actions":["a"],"metrics":["m"]},"90day":{"goals":["g"],"actions":["a"],"metrics":["m"]}}}

Generate 5 content ideas, 2 scripts, and detailed growth blueprints.`;
}

async function callProvider(
  provider: AIProvider,
  prompt: string
): Promise<string> {
  const url = provider.name === "google"
    ? `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`
    : `${provider.baseUrl}/chat/completions`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 5000;
      console.log(`Retrying ${provider.name} in ${delay / 1000}s (attempt ${attempt + 1}/3)...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(url, {
      ...provider.formatRequest(prompt),
      signal: AbortSignal.timeout(120000),
    });

    if (res.status === 429) {
      const errorText = await res.text().catch(() => "");
      if (attempt < 2) {
        console.log(`${provider.name} rate limited, retrying...`);
        continue;
      }
      throw new Error(`${provider.name} rate limited: ${errorText}`);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`${provider.name} API error ${res.status}: ${errorText}`);
    }

    return provider.parseResponse(res);
  }

  throw new Error(`${provider.name} failed after 3 attempts`);
}

function parseAnalysisResponse(text: string): ChannelAnalysis {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    strategy: {
      contentType: parsed.strategy?.contentType || ["educational", "entertainment"],
      postingSchedule: parsed.strategy?.postingSchedule || "3-4 videos per week",
      thumbnailStyle: parsed.strategy?.thumbnailStyle || "Bold text, bright colors, face reactions",
      titleFormula: parsed.strategy?.titleFormula || "Question + Curiosity gap",
      tagStrategy: parsed.strategy?.tagStrategy || [],
      uniqueSellingPoints: parsed.strategy?.uniqueSellingPoints || [],
    },
    contentIdeas: (parsed.contentIdeas || []).slice(0, 10).map((idea: Record<string, unknown>) => ({
      title: String(idea.title || "Untitled"),
      description: String(idea.description || ""),
      contentType: (["video", "short", "series"].includes(String(idea.contentType)) ? idea.contentType : "video") as "video" | "short" | "series",
      estimatedViews: (["high", "medium", "low"].includes(String(idea.estimatedViews)) ? idea.estimatedViews : "medium") as "high" | "medium" | "low",
      difficulty: (["easy", "medium", "hard"].includes(String(idea.difficulty)) ? idea.difficulty : "medium") as "easy" | "medium" | "hard",
    })),
    scripts: (parsed.scripts || []).slice(0, 3).map((script: Record<string, unknown>) => ({
      title: String(script.title || "Untitled Script"),
      hook: String(script.hook || ""),
      intro: String(script.intro || ""),
      bodySections: Array.isArray(script.bodySections) ? script.bodySections.map(String) : [],
      outro: String(script.outro || ""),
      estimatedDuration: Number(script.estimatedDuration) || 600,
    })),
    growthBlueprint: {
      "30day": {
        goals: parsed.growthBlueprint?.["30day"]?.goals || [],
        actions: parsed.growthBlueprint?.["30day"]?.actions || [],
        metrics: parsed.growthBlueprint?.["30day"]?.metrics || [],
      },
      "60day": {
        goals: parsed.growthBlueprint?.["60day"]?.goals || [],
        actions: parsed.growthBlueprint?.["60day"]?.actions || [],
        metrics: parsed.growthBlueprint?.["60day"]?.metrics || [],
      },
      "90day": {
        goals: parsed.growthBlueprint?.["90day"]?.goals || [],
        actions: parsed.growthBlueprint?.["90day"]?.actions || [],
        metrics: parsed.growthBlueprint?.["90day"]?.metrics || [],
      },
    },
  };
}

export async function analyzeChannel(
  channel: ChannelInfo,
  videos: VideoInfo[]
): Promise<ChannelAnalysis> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error("No AI providers configured. Add GROQ_API_KEY, AIHUBMIX_API_KEY, or OPENROUTER_API_KEY to .env.local");
  }

  const prompt = buildAnalysisPrompt(channel, videos);
  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`Trying AI provider: ${provider.name}`);
      const response = await callProvider(provider, prompt);
      const analysis = parseAnalysisResponse(response);
      console.log(`Success with provider: ${provider.name}`);
      return analysis;
    } catch (err) {
      console.error(`Provider ${provider.name} failed:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error("All AI providers failed");
}

export function saveAnalysis(channelId: string, analysis: ChannelAnalysis) {
  const now = Date.now();

  run("DELETE FROM channel_content_ideas WHERE channel_id = $channel_id", { channel_id: channelId });
  run("DELETE FROM channel_scripts WHERE channel_id = $channel_id", { channel_id: channelId });
  run("DELETE FROM channel_growth_blueprints WHERE channel_id = $channel_id", { channel_id: channelId });

  for (const idea of analysis.contentIdeas) {
    run(
      `INSERT INTO channel_content_ideas (channel_id, idea_title, idea_description, content_type, estimated_views, difficulty, created_at)
       VALUES ($channel_id, $idea_title, $idea_description, $content_type, $estimated_views, $difficulty, $created_at)`,
      {
        channel_id: channelId,
        idea_title: idea.title,
        idea_description: idea.description,
        content_type: idea.contentType,
        estimated_views: idea.estimatedViews,
        difficulty: idea.difficulty,
        created_at: now,
      }
    );
  }

  for (const script of analysis.scripts) {
    run(
      `INSERT INTO channel_scripts (channel_id, script_title, hook, intro, body_sections, outro, estimated_duration, created_at)
       VALUES ($channel_id, $script_title, $hook, $intro, $body_sections, $outro, $estimated_duration, $created_at)`,
      {
        channel_id: channelId,
        script_title: script.title,
        hook: script.hook,
        intro: script.intro,
        body_sections: JSON.stringify(script.bodySections),
        outro: script.outro,
        estimated_duration: script.estimatedDuration,
        created_at: now,
      }
    );
  }

  for (const phase of ["30day", "60day", "90day"] as const) {
    const blueprint = analysis.growthBlueprint[phase];
    run(
      `INSERT INTO channel_growth_blueprints (channel_id, phase, goals, actions, metrics, created_at)
       VALUES ($channel_id, $phase, $goals, $actions, $metrics, $created_at)`,
      {
        channel_id: channelId,
        phase,
        goals: JSON.stringify(blueprint.goals),
        actions: JSON.stringify(blueprint.actions),
        metrics: JSON.stringify(blueprint.metrics),
        created_at: now,
      }
    );
  }

  run(
    "UPDATE trending_channels SET last_analyzed = $now WHERE channel_id = $channel_id",
    { channel_id: channelId, now }
  );

  run(
    `INSERT OR REPLACE INTO similar_channel_analysis (source_channel_id, target_channel_id, similarity_score, analysis_json, created_at)
     VALUES ($source, $target, $score, $json, $now)`,
    {
      source: channelId,
      target: channelId,
      score: 100,
      json: JSON.stringify(analysis.strategy),
      now,
    }
  );
}

export function getAnalysis(channelId: string): {
  strategy: ChannelAnalysis["strategy"] | null;
  contentIdeas: ChannelAnalysis["contentIdeas"];
  scripts: ChannelAnalysis["scripts"];
  growthBlueprint: ChannelAnalysis["growthBlueprint"] | null;
} {
  const strategyRow = get<{ analysis_json: string }>(
    "SELECT analysis_json FROM similar_channel_analysis WHERE source_channel_id = $id ORDER BY created_at DESC LIMIT 1",
    { id: channelId }
  );

  const contentIdeas = all<{
    idea_title: string;
    idea_description: string;
    content_type: string;
    estimated_views: string;
    difficulty: string;
  }>("SELECT * FROM channel_content_ideas WHERE channel_id = $id", { id: channelId }).map((r) => ({
    title: r.idea_title,
    description: r.idea_description,
    contentType: r.content_type as "video" | "short" | "series",
    estimatedViews: r.estimated_views as "high" | "medium" | "low",
    difficulty: r.difficulty as "easy" | "medium" | "hard",
  }));

  const scripts = all<{
    script_title: string;
    hook: string;
    intro: string;
    body_sections: string;
    outro: string;
    estimated_duration: number;
  }>("SELECT * FROM channel_scripts WHERE channel_id = $id", { id: channelId }).map((r) => ({
    title: r.script_title,
    hook: r.hook,
    intro: r.intro,
    bodySections: JSON.parse(r.body_sections || "[]"),
    outro: r.outro,
    estimatedDuration: r.estimated_duration,
  }));

  const blueprintRows = all<{
    phase: string;
    goals: string;
    actions: string;
    metrics: string;
  }>("SELECT * FROM channel_growth_blueprints WHERE channel_id = $id", { id: channelId });

  let growthBlueprint: ChannelAnalysis["growthBlueprint"] | null = null;
  if (blueprintRows.length > 0) {
    growthBlueprint = {
      "30day": { goals: [], actions: [], metrics: [] },
      "60day": { goals: [], actions: [], metrics: [] },
      "90day": { goals: [], actions: [], metrics: [] },
    };
    for (const row of blueprintRows) {
      const phase = row.phase as "30day" | "60day" | "90day";
      if (growthBlueprint[phase]) {
        growthBlueprint[phase] = {
          goals: JSON.parse(row.goals || "[]"),
          actions: JSON.parse(row.actions || "[]"),
          metrics: JSON.parse(row.metrics || "[]"),
        };
      }
    }
  }

  return {
    strategy: strategyRow ? JSON.parse(strategyRow.analysis_json) : null,
    contentIdeas,
    scripts,
    growthBlueprint,
  };
}

export function isAnalyzed(channelId: string): boolean {
  const row = get<{ count: number }>(
    "SELECT COUNT(*) as count FROM channel_scripts WHERE channel_id = $id",
    { id: channelId }
  );
  return (row?.count ?? 0) > 0;
}
