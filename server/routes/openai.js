import { Router } from "express";
import { openai } from "../config.js";

const router = Router();

const SYSTEM_PROMPT = `You are a music recommendation assistant. Given a user's prompt (mood, activity, genre, era, etc.), return a JSON object with either a "tracks" array or an "error" string. If you can find good matches, return: {"playlistTitle": string, "tracks": [...]}. playlistTitle must be a concise playlist name (about 3–7 words) that summarizes the user's request—suitable for Spotify; no surrounding quotes; prefer Title Case when natural; keep it under 80 characters. Return at least 10 tracks when possible; there is usually enough content to fill a playlist. Each track must have: title (string), artist (string), album (string), year (number, release year), confidence (number 0-100, how well this song fits the prompt), reason (string, one sentence explaining why this song fits the prompt). Only return an error for truly unusable prompts: offensive content, gibberish, or explicitly impossible requests. Otherwise always try to generate recommendations. Return ONLY valid JSON, no markdown or explanation. Example success: {"playlistTitle":"High-Energy Workout Anthems","tracks":[{"title":"Song Name","artist":"Artist Name","album":"Album Name","year":2020,"confidence":92,"reason":"The driving rhythm and anthemic chorus perfectly match the high-energy workout vibe."}]}`;

const BASELINE_TEMPERATURE = 0.7;
const MIN_TEMPERATURE = 0.2;
const MAX_TEMPERATURE = 1.0;
const HARD_PRECISION_TEMPERATURE_CAP = 0.75;

const PRECISION_CUES = [
  { phrase: "exact", weight: -0.1 },
  { phrase: "strict", weight: -0.12 },
  { phrase: "only", weight: -0.08 },
  { phrase: "must include", weight: -0.1, hard: true },
  { phrase: "no surprises", weight: -0.14, hard: true },
  { phrase: "predictable", weight: -0.08 },
  { phrase: "safe picks", weight: -0.08 },
  { phrase: "mainstream only", weight: -0.1 },
  { phrase: "radio hits", weight: -0.08 },
  { phrase: "family-friendly", weight: -0.08 },
  { phrase: "clean", weight: -0.06 },
  { phrase: "no explicit", weight: -0.1, hard: true },
  { phrase: "json only", weight: -0.08 },
  { phrase: "deterministic", weight: -0.14, hard: true },
];

const EXPLORATION_CUES = [
  { phrase: "surprise me", weight: 0.14 },
  { phrase: "deep cuts", weight: 0.14 },
  { phrase: "hidden gems", weight: 0.14 },
  { phrase: "experimental", weight: 0.12 },
  { phrase: "obscure", weight: 0.1 },
  { phrase: "left-field", weight: 0.1 },
  { phrase: "adventurous", weight: 0.1 },
  { phrase: "eclectic", weight: 0.1 },
  { phrase: "underground", weight: 0.1 },
  { phrase: "novel", weight: 0.08 },
  { phrase: "fresh", weight: 0.08 },
  { phrase: "unexpected", weight: 0.1 },
  { phrase: "boundary-pushing", weight: 0.12 },
];

const INTENSITY_MODIFIERS = ["very", "super", "ultra", "extremely"];
const HARD_CONSTRAINT_PATTERNS = [
  /\bexactly\s+\d+\s+(songs?|tracks?)\b/i,
  /\bmust be from\b/i,
  /\bno artists repeated\b/i,
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const MAX_PLAYLIST_TITLE_LEN = 100;

function sanitizePlaylistTitle(value) {
  if (typeof value !== "string") return undefined;
  const t = value.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  return t.length > MAX_PLAYLIST_TITLE_LEN ? t.slice(0, MAX_PLAYLIST_TITLE_LEN) : t;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasIntensityModifierNearExplorationCue(text, cuePhrase) {
  const cueStartWord = cuePhrase.split(/\s+/)[0];
  const modifierPattern = INTENSITY_MODIFIERS.map(escapeRegExp).join("|");
  const regex = new RegExp(
    `\\b(?:${modifierPattern})\\b(?:\\W+\\w+){0,2}\\W+\\b${escapeRegExp(cueStartWord)}\\b`,
    "i"
  );
  return regex.test(text);
}

function getTemperatureDecision(prompt) {
  const text = String(prompt || "").toLowerCase();
  let score = 0;
  let hasHardPrecisionConstraint = false;
  const matchedPrecisionCues = [];
  const matchedExplorationCues = [];
  const matchedHardConstraints = [];

  for (const cue of PRECISION_CUES) {
    if (text.includes(cue.phrase)) {
      score += cue.weight;
      matchedPrecisionCues.push(cue.phrase);
      if (cue.hard) hasHardPrecisionConstraint = true;
    }
  }

  for (const cue of EXPLORATION_CUES) {
    if (text.includes(cue.phrase)) {
      score += cue.weight;
      matchedExplorationCues.push(cue.phrase);
      if (hasIntensityModifierNearExplorationCue(text, cue.phrase)) {
        score += 0.05;
      }
    }
  }

  for (const pattern of HARD_CONSTRAINT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matchedHardConstraints.push(match[0]);
      hasHardPrecisionConstraint = true;
      score -= 0.08;
    }
  }

  const rawTemperature = BASELINE_TEMPERATURE + score;
  const boundedTemperature = clamp(rawTemperature, MIN_TEMPERATURE, MAX_TEMPERATURE);
  const temperature = hasHardPrecisionConstraint
    ? Math.min(boundedTemperature, HARD_PRECISION_TEMPERATURE_CAP)
    : boundedTemperature;

  return {
    temperature: Number(temperature.toFixed(2)),
    score: Number(score.toFixed(2)),
    matchedPrecisionCues,
    matchedExplorationCues,
    matchedHardConstraints,
  };
}

router.post("/", async (req, res) => {
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
    const { temperature, score, matchedPrecisionCues, matchedExplorationCues, matchedHardConstraints } = getTemperatureDecision(prompt);

    console.debug("OpenAI temperature decision", {
      temperature,
      score,
      precisionCueCount: matchedPrecisionCues.length,
      explorationCueCount: matchedExplorationCues.length,
      hardConstraintCount: matchedHardConstraints.length,
      matchedCueCategories: {
        precision: matchedPrecisionCues,
        exploration: matchedExplorationCues,
        hardConstraints: matchedHardConstraints,
      },
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt.trim() },
      ],
      temperature,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const raw = text.replace(/^```json\n?|\n?```$/g, "").trim();
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Invalid response from AI" });
    }

    if (parsed.error) {
      return res.status(422).json({ error: parsed.error });
    }

    const tracks = parsed.tracks ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(tracks)) {
      return res.status(502).json({ error: "AI did not return a valid response" });
    }

    const normalized = tracks
      .filter((t) => t.title && t.artist)
      .map((t, i) => ({
        id: `track-${Date.now()}-${i}`,
        title: String(t.title),
        artist: String(t.artist),
        album: String(t.album || ""),
        year: typeof t.year === "number" ? t.year : undefined,
        confidence: typeof t.confidence === "number" ? Math.min(100, Math.max(0, t.confidence)) : undefined,
        reason: t.reason ? String(t.reason) : undefined,
      }));

    const playlistTitle = sanitizePlaylistTitle(parsed.playlistTitle);

    return res.json({ tracks: normalized, ...(playlistTitle ? { playlistTitle } : {}) });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(502).json({
      error: err.message || "Failed to generate recommendations",
    });
  }
});

/**
 * Filter tracks for corporate appropriateness using OpenAI.
 * @param {Array<{uri: string, title: string, artist: string, explicit?: boolean}>} tracks
 * @returns {Promise<string[]>} URIs to keep
 */
export async function filterTracksForCorporate(tracks) {
  if (!openai || !Array.isArray(tracks) || tracks.length === 0) {
    return tracks.map((t) => t.uri).filter(Boolean);
  }

  const list = tracks.map((t) => ({
    uri: t.uri,
    title: t.title,
    artist: t.artist,
    explicit: t.explicit ?? false,
  }));

  const prompt = `Filter these tracks for corporate/family-friendly appropriateness. Exclude explicit content, suggestive lyrics, controversial themes, or anything that wouldn't be suitable for a shared workplace playlist. Return a JSON object with a "uris" array containing only the URIs to KEEP. If you are unsure about a track, exclude it. Return ONLY valid JSON, no markdown. Tracks:\n${JSON.stringify(list)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const raw = text.replace(/^```json\n?|\n?```$/g, "").trim();
    const parsed = JSON.parse(raw);
    const uris = parsed.uris ?? parsed;
    return Array.isArray(uris) ? uris.filter((u) => typeof u === "string") : [];
  } catch (e) {
    console.error("Content filter error:", e);
    return list.map((t) => t.uri).filter(Boolean);
  }
}

export default router;
