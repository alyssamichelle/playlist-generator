import "dotenv/config";

/**
 * Backend API for playlist generation.
 * - POST /api/generate: Uses OpenAI to suggest songs from a prompt
 * - POST /api/playlist: Creates a Spotify playlist (requires prior OAuth)
 * - GET /api/spotify/auth: Initiates Spotify OAuth
 * - GET /api/spotify/callback: OAuth callback
 */

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import session from "express-session";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "playlist-generator-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3001/api/spotify/callback";

/** Generate song suggestions from a prompt using OpenAI */
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt is required" });
  }
  if (!openai) {
    return res.status(503).json({
      error: "OpenAI is not configured. Set OPENAI_API_KEY in .env",
    });
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a music recommendation assistant. Given a user's prompt (mood, activity, genre, era, etc.), return a JSON array of exactly 15-20 song recommendations. Each object must have: title (string), artist (string), album (string), year (number, release year). Return ONLY valid JSON, no markdown or explanation. Example format: [{"title":"Song Name","artist":"Artist Name","album":"Album Name","year":2020}]`,
        },
        {
          role: "user",
          content: prompt.trim(),
        },
      ],
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content?.trim() || "[]";
    const raw = text.replace(/^```json\n?|\n?```$/g, "").trim();
    let tracks;
    try {
      tracks = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Invalid response from AI" });
    }
    if (!Array.isArray(tracks)) {
      return res.status(502).json({ error: "AI did not return an array" });
    }
    const normalized = tracks
      .filter((t) => t.title && t.artist)
      .map((t, i) => ({
        id: `track-${Date.now()}-${i}`,
        title: String(t.title),
        artist: String(t.artist),
        album: String(t.album || ""),
        year: typeof t.year === "number" ? t.year : undefined,
      }));
    return res.json({ tracks: normalized });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(502).json({
      error: err.message || "Failed to generate recommendations",
    });
  }
});

/** Start Spotify OAuth */
app.get("/api/spotify/auth", (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(503).json({
      error: "Spotify is not configured. Set SPOTIFY_CLIENT_ID in .env",
    });
  }
  const scopes = [
    "playlist-modify-public",
    "playlist-modify-private",
    "user-read-private",
  ].join(" ");
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  url.searchParams.set("scope", scopes);
  res.redirect(url.toString());
});

/** Spotify OAuth callback */
app.get("/api/spotify/callback", async (req, res) => {
  const { code } = req.query;
  if (!code || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.redirect("/?spotify_error=config");
  }
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
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
      req.session.spotifyAccessToken = data.access_token;
      req.session.spotifyRefreshToken = data.refresh_token;
    }
  } catch (e) {
    console.error("Spotify token exchange:", e);
  }
  res.redirect("http://localhost:5173/?spotify_authenticated=1");
});

/** Create Spotify playlist from track list */
app.post("/api/playlist", async (req, res) => {
  const { tracks } = req.body;
  const token = req.session?.spotifyAccessToken;
  if (!token) {
    return res.status(401).json({
      error: "Not authenticated with Spotify",
      needsAuth: true,
    });
  }
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(503).json({
      error: "Spotify is not configured",
    });
  }
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return res.status(400).json({ error: "Tracks array is required" });
  }

  try {
    const uris = [];
    for (const t of tracks) {
      const query = encodeURIComponent(`track:${t.title} artist:${t.artist}`);
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await searchRes.json();
      const item = data.tracks?.items?.[0];
      if (item?.uri) uris.push(item.uri);
    }

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json();
    const userId = me.id;
    if (!userId) {
      return res.status(401).json({ error: "Could not get Spotify user" });
    }

    const createRes = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "PlaylistGenerator – " + new Date().toLocaleDateString(),
          description: "Generated by PlaylistGenerator",
        }),
      }
    );
    const playlist = await createRes.json();
    const playlistId = playlist.id;
    if (!playlistId) {
      return res.status(502).json({ error: "Failed to create playlist" });
    }

    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: batch }),
        }
      );
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
