import { getKeyword, getKeywordSnapshots, getRankedVideos, rankKeyword, decodeTerm } from "@/lib/keywordEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/keywords/[term]">) {
  const { term: raw } = await ctx.params;
  const term = decodeTerm(raw);
  const keyword = getKeyword(term);
  if (!keyword) {
    return Response.json({ error: `Keyword "${term}" not found. Run research first.` }, { status: 404 });
  }
  return Response.json({
    keyword,
    snapshots: getKeywordSnapshots(term),
    rankedVideos: getRankedVideos(term),
  });
}

interface Body {
  forceRefresh?: boolean;
}

export async function POST(request: Request, ctx: RouteContext<"/api/keywords/[term]">) {
  const { term: raw } = await ctx.params;
  const term = decodeTerm(raw);
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // no body is fine
  }
  const ranked = await rankKeyword(term, { forceRefresh: body.forceRefresh });
  if (!ranked) {
    return Response.json({ error: `Could not rank "${term}"` }, { status: 500 });
  }
  return Response.json({
    keyword: getKeyword(term),
    snapshots: getKeywordSnapshots(term),
    rankedVideos: getRankedVideos(term),
  });
}
