import { clearOAuth } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  clearOAuth();
  return Response.json({ ok: true });
}