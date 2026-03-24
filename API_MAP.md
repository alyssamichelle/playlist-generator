# API Call Map

## Auth Flow (App Init)

```
App loads
    │
    ▼
getSpotifyStatus() [`src/api/client.ts:47`]  →  GET /api/spotify/status [`server/routes/spotify.js:65`]
    • Headers: x-spotify-token (optional — omit when no user token)
    • Returns: { authenticated, displayName?, avatarUrl?, isCompanyAccount? }
    • getToken helper: [`server/routes/spotify.js:14`]
    •
    • When no user token: backend checks company token; returns authenticated: true
    •   with isCompanyAccount: true if SPOTIFY_COMPANY_* env vars are set.
    • User is never redirected to Spotify on load; sign-in is optional.
```

## Full Flow: From User Prompt to Playlist

```
User submits prompt [`src/Home.tsx:182` SearchForm onSubmit → `handleSearch` `src/Home.tsx:79`]
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3a: Generate Track List (AI)                                           │
│                                                                              │
│ generateTracks(prompt) [`src/api/client.ts:85`]  →  POST /api/openai         │
│   Route handler [`server/routes/openai.js:121`]                              │
│   • Body: { prompt: string }                                                 │
│   • Headers: x-spotify-token (optional) [`src/api/client.ts:88`]             │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │ OpenAI (GPT-4o-mini): [`server/routes/openai.js:149`]                │   │
│   │ Uses adaptive temperature [`getTemperatureDecision` `openai.js:71`]  │   │
│   │   from prompt cues (precision vs exploration)                        │   │
│   │ Returns: title, artist, album, year, confidence, reason per track    │   │
│   │   (normalized [`openai.js:177`])                                     │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Returns: { tracks: [...] } [`openai.js:189`]                               │
└──────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3b: Resolve on Spotify (before grid)                                  │
│                                                                             │
│ resolveTracksWithSpotify(tracks) [`src/api/client.ts:97`]  →                │
│   POST /api/spotify/resolve-tracks [`server/routes/spotify.js:187`]         │
│   • Body: { tracks } — same shape as OpenAI output                          │
│   • Headers: x-spotify-token (optional) [`src/api/client.ts:100`]           │
│   • Per-track search: loop [`server/routes/spotify.js:206`],                │
│     `searchSpotifyTrack` [`server/routes/spotify.js:30`] (GET /v1/search    │
│     [`server/routes/spotify.js:32`])                                        │
│   • 401 + needsAuth [`server/routes/spotify.js:191`] → client redirect      │
│     [`src/api/client.ts:109`]                                               │
│   • 422 if no matches [`server/routes/spotify.js:243`]                      │
│                                                                             │
│   Returns enriched rows [`server/routes/spotify.js:227`]: Spotify id,       │
│   album, year, spotifyUri, explicit, plus confidence/reason. Unmatched      │
│   suggestions omitted.                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        Grid from resolved tracks [`Home.tsx:85`–`87`]
        User reviews / edits selection
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Create Playlist in Spotify                                         │
│                                                                             │
│ createPlaylist(...) [`src/api/client.ts:118`]  →                            │
│   POST /api/spotify/playlist [`server/routes/spotify.js:258`]               │
│   • Body: { tracks, name?, existingPlaylistId? } [`client.ts:125`]          │
│   • Headers: x-spotify-token (optional) [`client.ts:124`]                   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        Server playlist handler [`server/routes/spotify.js:275`–`366`] (in order):
                    │
                    │  A. Resolve URI per track: skip search if spotifyUri set
                    │     [`server/routes/spotify.js:279`–`287`]; else
                    │     `searchSpotifyTrack` [`server/routes/spotify.js:289`–`307`]
                    │  B. If company: filterTracksForCorporate(found)
                    │     [`server/routes/spotify.js:310`–`313`]
                    │     [`server/routes/openai.js:203`]
                    │  C. Create playlist [`server/routes/spotify.js:318`–`338`] or use
                    │     existingPlaylistId
                    │  D. Add tracks in batches [`server/routes/spotify.js:340`–`361`]
                    │
                    ▼
        Returns: { playlistId, embedUrl } [`server/routes/spotify.js:363`–`366`]
```

## OpenAI Usage Summary

| Phase | When | Purpose |
|-------|------|---------|
| **Phase 3** | User clicks "Generate" | **Primary:** OpenAI suggests tracks (adaptive temperature [`openai.js:71`]), then Spotify resolves each suggestion before the grid (`resolve-tracks` [`server/routes/spotify.js:187`]); unmatched rows are dropped |
| **Phase 4** | User clicks "Create Playlist" (company accounts only) | **Secondary:** Filter explicit content [`openai.js:203`] before adding tracks to the playlist |

## Spotify Usage Summary

| Phase | When | Purpose |
|-------|------|---------|
| **Session / UI** | App load (authenticated) | **Primary:** `getSpotifyStatus` → GET `/api/spotify/status` [`src/api/client.ts:47`] → Spotify **GET /v1/me** [`server/routes/spotify.js:70`]; optional **GET /v1/me/playlists** via `getUserPlaylists` [`src/api/client.ts:67`, `server/routes/spotify.js:104`] |
| **OAuth** | User starts or completes Spotify sign-in | **Primary:** Browser redirect to **authorize** [`server/routes/spotify.js:136`]; **POST** token exchange on callback [`server/routes/spotify.js:153`]. Company/demo: **refresh access token** when configured [`server/config.js:38`] |
| **Phase 3b** | User clicks "Generate" (after OpenAI) | **Primary:** `resolveTracksWithSpotify` [`src/api/client.ts:97`] → POST **resolve-tracks** [`server/routes/spotify.js:187`]; per suggestion **GET /v1/search** via `searchSpotifyTrack` [`server/routes/spotify.js:32`] |
| **Phase 4** | User clicks "Create Playlist" | **Primary:** `createPlaylist` [`src/api/client.ts:118`] → POST **playlist** [`server/routes/spotify.js:258`]. Optionally **GET /v1/search** if `spotifyUri` missing [`server/routes/spotify.js:291`, `server/routes/spotify.js:32`]; then **POST /v1/me/playlists** [`server/routes/spotify.js:318`] and **POST /v1/playlists/{id}/items** [`server/routes/spotify.js:344`]. Company accounts use the same Web API with a server-held token via `getToken` [`server/routes/spotify.js:14`]; corporate filtering in this phase is OpenAI-driven ([`openai.js:203`]) while Spotify still performs playlist writes above. |
