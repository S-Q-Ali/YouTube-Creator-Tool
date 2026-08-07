import { cookies } from "next/headers";
import { exchangeCode, oauthEnabled } from "@/lib/oauth";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 2: Google redirects here with ?code=&state=. Exchange, store, bounce to /audit. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`${config.appBaseUrl}/settings?oauth=error`, 302);
  }
  if (!code) {
    return Response.redirect(`${config.appBaseUrl}/settings?oauth=missing_code`, 302);
  }
  if (!oauthEnabled()) {
    return Response.redirect(`${config.appBaseUrl}/settings?oauth=not_configured`, 302);
  }

  // CSRF: validate state against the cookie set in /api/auth/start.
  const cookieStore = await cookies();
  const expected = cookieStore.get("oauth_state")?.value;
  if (expected && state !== expected) {
    return Response.redirect(`${config.appBaseUrl}/settings?oauth=bad_state`, 302);
  }
  cookieStore.delete("oauth_state");

  try {
    await exchangeCode(code);
    return Response.redirect(`${config.appBaseUrl}/audit?oauth=connected`, 302);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "exchange failed");
    return Response.redirect(`${config.appBaseUrl}/settings?oauth=failed&detail=${msg}`, 302);
  }
}