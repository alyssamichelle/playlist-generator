import OpenAI from "openai";

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
export const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:3001/api/spotify/callback";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const SPOTIFY_COMPANY_ACCESS_TOKEN =
  process.env.SPOTIFY_COMPANY_ACCESS_TOKEN;
export const SPOTIFY_COMPANY_REFRESH_TOKEN =
  process.env.SPOTIFY_COMPANY_REFRESH_TOKEN;

export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** In-memory cache for company token (refreshed from env/API) */
let companyTokenCache = { token: null, expiresAt: 0 };

/**
 * Get a valid company Spotify token, refreshing if expired.
 * Returns null if company account is not configured.
 */
export async function getCompanyToken() {
  const refreshToken = SPOTIFY_COMPANY_REFRESH_TOKEN;
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (companyTokenCache.token && companyTokenCache.expiresAt > now + bufferMs) {
    return companyTokenCache.token;
  }

  // Prefer refresh; fall back to static access token from env
  if (refreshToken && SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiresIn = (data.expires_in ?? 3600) * 1000;
        companyTokenCache = {
          token: data.access_token,
          expiresAt: now + expiresIn,
        };
        return companyTokenCache.token;
      }
    } catch (e) {
      console.error("Company token refresh failed:", e);
    }
  }

  if (SPOTIFY_COMPANY_ACCESS_TOKEN) {
    companyTokenCache = {
      token: SPOTIFY_COMPANY_ACCESS_TOKEN,
      expiresAt: now + 3600000,
    };
    return companyTokenCache.token;
  }

  return null;
}
