# API Call Map

## Auth Flow (App Init)

```
App loads
    │
    ▼
getSpotifyStatus()  →  GET /api/spotify/status
    • Headers: x-spotify-token (optional — omit when no user token)
    • Returns: { authenticated, displayName?, avatarUrl?, isCompanyAccount? }
    •
    • When no user token: backend checks company tokens; returns authenticated: true
    •   with isCompanyAccount: true if SPOTIFY_COMPANY_* env vars are set.
    • User is never redirected to Spotify on load; sign-in is optional.
```

## Full Flow: From User Prompt to Playlist

```
User submits prompt (e.g., "upbeat workout music")
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Generate Track List                                                 │
│                                                                              │
│ generateTracks(prompt)  →  POST /api/openai                                  │
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
│ createPlaylist(tracks, name?, existingPlaylistId?)                           │
│   →  POST /api/spotify/playlist                                              │
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
│         │                   │ explicit    │      │ /v1/me/      │  │ POST        │
└─────────┘                   │ content     │      │ playlists    │  │ /v1/playlists│
                              └─────────────┘      └──────────────┘  │ /{id}/tracks│
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
