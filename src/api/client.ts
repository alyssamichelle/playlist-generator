/**
 * API client for playlist generation backend.
 */

import type { Track } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function generateTracks(prompt: string): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.trim() }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate songs");
  return data.tracks;
}

export async function createPlaylist(tracks: Track[]): Promise<{
  playlistId: string;
  embedUrl: string;
}> {
  const res = await fetch(`${API_BASE}/api/playlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tracks }),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.needsAuth) {
      window.location.href = `${API_BASE}/api/spotify/auth`;
      throw new Error("Redirecting to Spotify login…");
    }
    throw new Error(data.error || "Failed to create playlist");
  }
  return { playlistId: data.playlistId, embedUrl: data.embedUrl };
}
