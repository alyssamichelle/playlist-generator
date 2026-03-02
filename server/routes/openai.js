import { Router } from "express";
import { openai } from "../config.js";

const router = Router();

const SYSTEM_PROMPT = `You are a music recommendation assistant. Given a user's prompt (mood, activity, genre, era, etc.), return a JSON object with either a "tracks" array or an "error" string. If you can find good matches, return: {"tracks": [...]}. Each track must have: title (string), artist (string), album (string), year (number, release year), confidence (number 0-100, how well this song fits the prompt), reason (string, one sentence explaining why this song fits the prompt). If you cannot find good matches (e.g. the prompt is unclear, offensive, or too obscure), return: {"error": "explanation of why you cannot make recommendations"}. Return ONLY valid JSON, no markdown or explanation. Example success: {"tracks":[{"title":"Song Name","artist":"Artist Name","album":"Album Name","year":2020,"confidence":92,"reason":"The driving rhythm and anthemic chorus perfectly match the high-energy workout vibe."}]}`;

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt.trim() },
      ],
      temperature: 0.7,
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

    return res.json({ tracks: normalized });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(502).json({
      error: err.message || "Failed to generate recommendations",
    });
  }
});

export default router;
