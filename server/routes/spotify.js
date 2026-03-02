import { Router } from "express";
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_URL,
  getCompanyToken,
} from "../config.js";
import { filterTracksForCorporate } from "./openai.js";

const router = Router();

/** Get effective Spotify token: user token or company token fallback */
async function getToken(req) {
  const userToken = req.headers["x-spotify-token"];
  if (userToken) return { token: userToken, isCompany: false };
  const companyToken = await getCompanyToken();
  if (companyToken) return { token: companyToken, isCompany: true };
  return null;
}

/** Check Spotify auth status and return basic profile info */
router.get("/status", async (req, res) => {
  const userToken = req.headers["x-spotify-token"];

  if (userToken) {
    try {
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const me = await meRes.json();
      if (!me.id) return res.json({ authenticated: false });
      return res.json({
        authenticated: true,
        displayName: me.display_name || me.id,
        avatarUrl: me.images?.[0]?.url || null,
      });
    } catch {
      return res.json({ authenticated: false });
    }
  }

  const companyToken = await getCompanyToken();
  if (companyToken) {
    return res.json({
      authenticated: true,
      isCompanyAccount: true,
      displayName: "Kendo UI",
    });
  }

  return res.json({ authenticated: false });
});

/** Get the current user's playlists */
router.get("/playlists", async (req, res) => {
  const token = req.headers["x-spotify-token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();
    const playlists = (data.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      trackCount: p.items?.total ?? 0,
      imageUrl: p.images?.[0]?.url ?? null,
    }));
    return res.json({ playlists });
  } catch (e) {
    console.error("Failed to fetch playlists:", e);
    return res.status(502).json({ error: "Failed to fetch playlists" });
  }
});

/** Start Spotify OAuth */
router.get("/auth", (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(503).json({
      error: "Spotify is not configured. Set SPOTIFY_CLIENT_ID in .env",
    });
  }

  const scopes = [
    "playlist-modify-public",
    "playlist-modify-private",
    "playlist-read-private",
    "user-read-private",
  ].join(" ");

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("show_dialog", "true");
  res.redirect(url.toString());
});

/** Spotify OAuth callback — exchanges code for token and redirects to frontend */
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/?spotify_error=config`);
  }

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();
    if (data.access_token) {
      const params = new URLSearchParams({
        spotify_access_token: data.access_token,
      });
      if (data.refresh_token)
        params.set("spotify_refresh_token", data.refresh_token);
      return res.redirect(`${FRONTEND_URL}/?${params}`);
    } else {
      console.error("Spotify token exchange failed:", data);
    }
  } catch (e) {
    console.error("Spotify token exchange error:", e);
  }

  res.redirect(`${FRONTEND_URL}/?spotify_error=auth_failed`);
});

/** Create or update a Spotify playlist from a list of tracks */
router.post("/playlist", async (req, res) => {
  const { tracks, name, existingPlaylistId } = req.body;
  const auth = await getToken(req);

  if (!auth) {
    return res.status(401).json({
      error: "Not authenticated with Spotify",
      needsAuth: true,
    });
  }

  const { token, isCompany } = auth;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return res.status(400).json({ error: "Tracks array is required" });
  }

  try {
    // Search Spotify for each track to get its URI and explicit flag
    const found = [];
    for (const t of tracks) {
      const query = encodeURIComponent(`${t.title} ${t.artist}`);
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const searchText = await searchRes.text();
      let data;
      try {
        data = JSON.parse(searchText);
      } catch {
        return res
          .status(502)
          .json({ error: "Spotify search returned unexpected response" });
      }
      const item = data.tracks?.items?.[0];
      if (item?.uri) {
        found.push({
          uri: item.uri,
          title: item.name,
          artist: item.artists?.[0]?.name ?? t.artist,
          explicit: item.explicit ?? false,
        });
      }
    }

    let uris = found.map((f) => f.uri);
    if (isCompany && found.length > 0) {
      uris = await filterTracksForCorporate(found);
    }

    // Use existing playlist or create a new one
    let playlistId = existingPlaylistId;
    if (!playlistId) {
      const createRes = await fetch("https://api.spotify.com/v1/me/playlists", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name:
            name || "PlaylistGenerator – " + new Date().toLocaleDateString(),
          description: "Generated by PlaylistGenerator",
          public: false,
        }),
      });
      const playlist = await createRes.json();
      playlistId = playlist.id;
      if (!playlistId) {
        return res.status(502).json({
          error: playlist.error?.message || "Failed to create playlist",
        });
      }
    }

    // Add tracks in batches of 100 (Spotify API limit)
    if (uris.length > 0) {
      for (let i = 0; i < uris.length; i += 100) {
        const addRes = await fetch(
          `https://api.spotify.com/v1/playlists/${playlistId}/items`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
          },
        );
        if (!addRes.ok) {
          const addData = await addRes.json();
          return res.status(502).json({
            error: addData.error?.message || "Failed to add tracks to playlist",
          });
        }
      }
    }

    return res.json({
      playlistId,
      embedUrl: `https://open.spotify.com/embed/playlist/${playlistId}`,
    });
  } catch (err) {
    console.error("Spotify API error:", err);
    return res.status(502).json({ error: "Spotify request failed" });
  }
});

export default router;
