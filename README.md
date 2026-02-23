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

## How it works

1. Type a mood, genre, or description (e.g. "chill indie for a rainy day")
2. Click **Generate** to get song suggestions from ChatGPT
3. Uncheck any songs you want to exclude
4. Optionally run a **New search** to add more songs
5. Click **Create Spotify playlist** — you’ll be prompted to log in with Spotify, then your playlist is created and embedded
