import { researchKeyword } from "@/lib/keywordEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  seed?: string;
  hl?: string;
  gl?: string;
  rankTop?: number;
  maxResults?: number;
  forceRefresh?: boolean;
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const seed = (body.seed ?? "").trim();
  if (!seed) {
    return Response.json({ error: "Missing 'seed' (a topic to research)" }, { status: 400 });
  }

  try {
    const output = await researchKeyword(seed, {
      hl: body.hl,
      gl: body.gl,
      rankTop: body.rankTop,
      maxResults: body.maxResults,
      forceRefresh: body.forceRefresh,
    });
    return Response.json(output);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
