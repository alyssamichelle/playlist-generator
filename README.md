# PlaylistGenerator

Generate Spotify playlists from natural language using ChatGPT.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Add your `OPENAI_API_KEY` (required for song generation)
   - Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - In your Spotify app settings, set Redirect URI to `http://localhost:3001/api/spotify/callback`

3. **Run the app**
   - Terminal 1: `npm run dev` (Vite frontend on :5173)
   - Terminal 2: `npm run dev:server` (API on :3001)
   - Or: `npm run dev:all` (requires `npm-run-all`)

## Hosting: client on Netlify, server on Render

- **Render (server):** Deploy the repo as a **Web Service**. Build: `npm run build` (or leave empty if you only run the server). Start: `node server/index.js`. Set env vars: `OPENAI_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET`, `FRONTEND_URL=https://your-app.netlify.app`, and `SPOTIFY_REDIRECT_URI=https://your-service.onrender.com/api/spotify/callback`. CORS is configured to allow the origin(s) in `FRONTEND_URL` (comma-separated if you have multiple).
- **Netlify (client):** Deploy the repo with build command `npm run build`, publish `dist`. In **Site settings → Environment variables** add `VITE_API_URL=https://your-service.onrender.com` so the client calls the Render API.
- **Spotify Dashboard:** Add redirect URI `https://your-service.onrender.com/api/spotify/callback`.

## How it works

1. Type a mood, genre, or description (e.g. "chill indie for a rainy day")
2. Click **Generate** to get song suggestions from ChatGPT
3. Uncheck any songs you want to exclude
4. Optionally run a **New search** to add more songs
5. Click **Create Spotify playlist** — you’ll be prompted to log in with Spotify, then your playlist is created and embedded

## Main files (where to look)

| File | Purpose |
|------|---------|
| [src/api/client.ts](src/api/client.ts) | Browser-side API client: **OpenAI** is only exposed as `POST /api/openai` (track generation). **Spotify** uses several paths under `/api/spotify/` (status, playlists, auth URL, resolve-tracks, create playlist). Sends `x-spotify-token` when the user is signed in; builds Spotify login redirect URLs. |
| [src/Home.tsx](src/Home.tsx) | Main screen: loads Spotify status and playlists, runs **Generate** (OpenAI → resolve on Spotify → grid), **Create playlist**, and wires child components. |
| [src/types/index.ts](src/types/index.ts) | TypeScript types for a track row (`Track`, `SelectableTrack`) shared by the grid and API responses. |
| [src/components/SearchForm.tsx](src/components/SearchForm.tsx) | Prompt input and submit for generation / search. |
| [src/components/PlaylistResults.tsx](src/components/PlaylistResults.tsx) | Kendo Grid of suggested tracks with checkboxes and optional confidence/reason columns. |
| [src/components/PlaylistActions.tsx](src/components/PlaylistActions.tsx) | Playlist mode (new vs existing), name, playlist picker, and **Create** button. |
| [src/components/PlaylistEmbed.tsx](src/components/PlaylistEmbed.tsx) | Spotify iframe embed after a playlist is created. |
| [server/index.js](server/index.js) | Express app entry: CORS, JSON body, mounts `/api/openai` and `/api/spotify`. |
| [server/config.js](server/config.js) | Environment variables, shared OpenAI client, company Spotify token refresh (`getCompanyToken`). |
| [server/routes/openai.js](server/routes/openai.js) | **POST /** — ChatGPT track suggestions with adaptive temperature from the prompt; exports `filterTracksForCorporate` for company playlists. |
| [server/routes/spotify.js](server/routes/spotify.js) | Spotify OAuth (auth + callback), status, user playlists, **resolve-tracks** (search each suggestion before the grid), **playlist** (create/add tracks). Includes `searchSpotifyTrack` helper. |
| [API_MAP.md](API_MAP.md) | Request/response flow and line-level map of API usage (OpenAI + Spotify). |