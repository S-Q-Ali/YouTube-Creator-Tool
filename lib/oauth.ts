import { config } from "./config";
import { getSetting, setSetting } from "./db";
import crypto from "node:crypto";

export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const INFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

const K_ACCESS = "oauth_access_token";
const K_REFRESH = "oauth_refresh_token";
const K_EXPIRY = "oauth_token_expires_at";
const K_SCOPE = "oauth_scope";
const K_CHANNEL_ID = "oauth_channel_id";

export function redirectUri(): string {
  return `${config.appBaseUrl.replace(/\/$/, "")}/api/auth/callback`;
}

export function oauthEnabled(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export function oauthChannelId(): string | undefined {
  return getSetting(K_CHANNEL_ID);
}

export function isConnected(): boolean {
  return Boolean(getSetting(K_REFRESH));
}

/** Build the Google consent URL with a fresh CSRF state (returns {url, state}). */
export function buildAuthUrl(providedState?: string): { url: string; state: string } {
  const state = providedState ?? crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return { url: `${AUTH_ENDPOINT}?${params.toString()}`, state };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

/** Exchange an auth code for tokens and persist them. */
export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error_description?: string };
      detail = j.error_description ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new Error("Token exchange returned no access token.");
  persistTokens(data);
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

function persistTokens(data: TokenResponse) {
  setSetting(K_ACCESS, data.access_token);
  setSetting(K_REFRESH, data.refresh_token ?? getSetting(K_REFRESH) ?? "");
  setSetting(K_EXPIRY, String(Date.now() + data.expires_in * 1000));
  setSetting(K_SCOPE, data.scope ?? OAUTH_SCOPES.join(" "));
}

/** Refresh using the stored refresh token. Throws if unavailable/revoked. */
export async function refreshAccessToken(): Promise<string> {
  const refresh = getSetting(K_REFRESH);
  if (!refresh) throw new Error("No refresh token.");

  const body = new URLSearchParams({
    refresh_token: refresh,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}).`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new Error("Refresh returned no access token.");
  persistTokens({ ...data, refresh_token: refresh });
  return data.access_token;
}

/** Return a valid access token, refreshing first if it's expired or missing. */
export async function getValidAccessToken(): Promise<string> {
  const access = getSetting(K_ACCESS);
  const expiry = Number(getSetting(K_EXPIRY) ?? 0);
  if (!access) throw new Error("Not connected to Google.");

  // Refresh if missing/expiring within 60s.
  if (!expiry || expiry - Date.now() < 60_000) {
    return refreshAccessToken();
  }
  return access;
}

/** Validate a token against Google's tokeninfo endpoint (returns channel-agnostic sub/aud). */
export async function introspectToken(token: string): Promise<{ email?: string }> {
  try {
    const res = await fetch(`${INFO_ENDPOINT}?${new URLSearchParams({ access_token: token })}`);
    if (!res.ok) return {};
    const j = (await res.json()) as { email?: string; error?: string };
    return { email: j.email };
  } catch {
    return {};
  }
}

export function clearOAuth() {
  for (const k of [K_ACCESS, K_REFRESH, K_EXPIRY, K_SCOPE, K_CHANNEL_ID]) {
    setSetting(k, "");
  }
}

export function setOwnChannelId(channelId: string) {
  setSetting(K_CHANNEL_ID, channelId);
}