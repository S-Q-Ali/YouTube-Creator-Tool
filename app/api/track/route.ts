import { addTracked, isTracked, listTracked, removeTracked } from "@/lib/tracking";

export const dynamic = "force-dynamic";

interface Body {
  kind?: "video" | "channel" | "keyword";
  refId?: string;
  label?: string;
  action: "add" | "remove";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!["video", "channel", "keyword"].includes(body.kind ?? "")) {
    return Response.json({ error: "'kind' must be video, channel, or keyword" }, { status: 400 });
  }
  if (!body.refId) {
    return Response.json({ error: "'refId' is required" }, { status: 400 });
  }

  if (body.action === "add") {
    addTracked(body.kind!, body.refId, body.label);
  } else if (body.action === "remove") {
    removeTracked(body.kind!, body.refId);
  } else {
    return Response.json({ error: "'action' must be add or remove" }, { status: 400 });
  }

  return Response.json({ tracked: isTracked(body.kind!, body.refId) });
}

export async function GET() {
  return Response.json({ tracked: listTracked() });
}
