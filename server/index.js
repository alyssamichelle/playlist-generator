import "dotenv/config";

/**
 * Backend API for playlist generation.
 * Routes:
 *   /api/openai         — POST: generate song suggestions via OpenAI
 *   /api/spotify/*      — Spotify OAuth, user profile, playlists, playlist creation
 */

import express from "express";
import cors from "cors";
import generateRouter from "./routes/openai.js";
import spotifyRouter from "./routes/spotify.js";

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-spotify-token"],
  }),
);

app.use(express.json());

app.use("/api/openai", generateRouter);
app.use("/api/spotify", spotifyRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
