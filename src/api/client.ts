/**
 * API client for playlist generation backend.
 */

import type { Track } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "spotify_access_token";

export function spotifyAuthUrl(): string {
  // Always use relative URL so the Vite proxy handles it in local dev,
  // and VITE_API_URL handles it in production.
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/spotify/auth`;
  }
  return `/api/spotify/auth`;
}

/** Call after redirect back from Spotify to persist the token from the URL. */
export function consumeSpotifyTokenFromUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("spotify_access_token");
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    // Clean the token out of the URL
    params.delete("spotify_access_token");
    params.delete("spotify_refresh_token");
    const clean = params.toString() ? `?${params}` : window.location.pathname;
    window.history.replaceState({}, "", clean);
    return true;
  }
  return false;
}

export function getSpotifyToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}


export interface SpotifyStatus {
  authenticated: boolean;
  displayName?: string;
  avatarUrl?: string | null;
  isCompanyAccount?: boolean;
}

export async function getSpotifyStatus(): Promise<SpotifyStatus> {
  const token = getSpotifyToken();
  const res = await fetch(`${API_BASE}/api/spotify/status`, {
    headers: token ? { "x-spotify-token": token } : {},
  });
  return res.json();
}

function spotifyHeaders(): HeadersInit {
  const token = getSpotifyToken();
  return token ? { "x-spotify-token": token } : {};
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string | null;
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const res = await fetch(`${API_BASE}/api/spotify/playlists`, {
    method: "GET",
    headers: {
      ...spotifyHeaders(),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch playlists: ${res.status}`);
  }

  const data = (await res.json()) as { playlists?: SpotifyPlaylist[] };
  return data.playlists ?? [];
}

export async function generateTracks(prompt: string): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/api/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...spotifyHeaders() },
    body: JSON.stringify({ prompt: prompt.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate songs");
  return data.tracks;
}

export async function createPlaylist(tracks: Track[], name?: string, existingPlaylistId?: string): Promise<{
  playlistId: string;
  embedUrl: string;
}> {
  const res = await fetch(`${API_BASE}/api/spotify/playlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...spotifyHeaders() },
    body: JSON.stringify({ tracks, name, existingPlaylistId }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.needsAuth) {
      window.location.href = spotifyAuthUrl();
      throw new Error("Redirecting to Spotify login…");
    }
    throw new Error(data.error || "Failed to create playlist");
  }
  return { playlistId: data.playlistId, embedUrl: data.embedUrl };
}
