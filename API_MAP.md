# API Call Map

## Auth Flow (App Init)

```
App loads
    │
    ▼
getSpotifyStatus() [`src/api/client.ts:47`]  →  GET /api/spotify/status [`server/routes/spotify.js:23`]
    • Headers: x-spotify-token (optional — omit when no user token)
    • Returns: { authenticated, displayName?, avatarUrl?, isCompanyAccount? }
    •
    • When no user token: backend checks company token; returns authenticated: true
    •   with isCompanyAccount: true if SPOTIFY_COMPANY_* env vars are set.
    • User is never redirected to Spotify on load; sign-in is optional.
```

## Full Flow: From User Prompt to Playlist

```
User submits prompt (e.g., "upbeat workout music") [`src/Home.tsx:181, 78`]
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Generate Track List                                                 │
│                                                                              │
│ generateTracks(prompt) [`src/Home.tsx:83`, `src/api/client.ts:85`]  →  POST /api/openai [`server/routes/openai.js:8`] │
│   • Body: { prompt: string }                                                 │
│   • Headers: x-spotify-token (optional)                                      │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ OpenAI (GPT-4o-mini): Generates song suggestions from user prompt   │   │
│   │ Returns: title, artist, album, year, confidence, reason per track   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Returns: { tracks: [...] }                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        User reviews / edits selection
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Create Playlist in Spotify                                          │
│                                                                              │
│ createPlaylist(tracks, name?, existingPlaylistId?) [`src/api/client.ts:96`] │
│   →  POST /api/spotify/playlist [`server/routes/spotify.js:145`]             │
│   • Body: { tracks, name?, existingPlaylistId? }                             │
│   • Headers: x-spotify-token (optional — backend uses company token if absent)│
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        Server does (in order):
                    │
     ┌──────────────┼──────────────┬──────────────────────┬─────────────────┐
     │              │              │                      │                 │
     ▼              │              ▼                      ▼                 ▼
┌─────────┐         │         ┌─────────────┐      ┌──────────────┐  ┌─────────────┐
│ Step A  │         │         │ Step B      │      │ Step C       │  │ Step D      │
│ Spotify │         │         │ If company: │      │ Create or    │  │ Add tracks  │
│ search  │─────────┘         │ OpenAI      │─────►│ use existing │─►│ in batches  │
│ for URI │  (for each track) │ filters     │      │ POST         │  │ of 100      │
│ [`server/routes/spotify.js:165`] │ │ explicit    │  │ /v1/me/ [`server/routes/spotify.js:199`] │ │ POST        │
└─────────┘                   │ [`server/routes/spotify.js:192`, `server/routes/openai.js:75`] │ │ playlists    │  │ /v1/playlists│
                              └─────────────┘      └──────────────┘  │ /{id}/items [`server/routes/spotify.js:225`]│
                                                                     └─────────────┘
                                                                              │
                                                                              ▼
                                                              Returns: { playlistId, embedUrl }
```

## OpenAI Usage Summary

| Phase | When | Purpose |
|-------|------|---------|
| **Phase 3** | User clicks "Generate" | **Primary:** Generate track suggestions from the user's text prompt (mood, genre, activity, etc.) |
| **Phase 4** | User clicks "Create Playlist" (company accounts only) | **Secondary:** Filter explicit content before adding tracks to the playlist |
