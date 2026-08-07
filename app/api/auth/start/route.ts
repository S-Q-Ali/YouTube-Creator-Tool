import { cookies } from "next/headers";
import { buildAuthUrl } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Step 1: redirect the user to Google's consent screen (with CSRF state cookie). */
export async function GET() {
  const { url, state } = buildAuthUrl();
  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return Response.redirect(url, 302);
}