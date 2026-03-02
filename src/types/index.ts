/**
 * Represents a song/track in our playlist flow.
 * Matches the structure returned by ChatGPT and used by the grid.
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  /** 0–100 score from OpenAI indicating how well this matches the prompt */
  confidence?: number;
  /** OpenAI's explanation for why this track fits the prompt */
  reason?: string;
  /** Spotify URI, populated when we resolve the track for playlist creation */
  spotifyUri?: string;
}

/** Track with selection state for the grid. */
export type SelectableTrack = Track & { selected: boolean };
