"use client";

import { AppBar, AppBarSection } from "@progress/kendo-react-layout";
import { Button } from "@progress/kendo-react-buttons";
import { useState, useCallback } from "react";

import "./Home.css";
import SearchForm from "./components/SearchForm";
import PlaylistGrid from "./grid/Grid";
import PlaylistEmbed from "./components/PlaylistEmbed";
import { generateTracks, createPlaylist } from "./api/client";
import type { Track, SelectableTrack } from "./types";

function toSelectableTrack(t: Track): SelectableTrack {
  return { ...t, selected: true };
}

const ErrorMessage = (props: { duckDuckGoose: string | null }) => {
  if (!props.duckDuckGoose) return null;
  return <div role="alert" className="error-message" aria-live="polite">{props.duckDuckGoose}</div>;
};

export default function Home() {
  const [tracks, setTracks] = useState<SelectableTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const handleSearch = useCallback(async (prompt: string) => {
    setError(null);
    setLoading(true);
    
    try {
      const newTracks = await generateTracks(prompt);
      const selectable = newTracks.map(toSelectableTrack);
      setTracks((prev) => [...prev, ...selectable]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate songs");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectionChange = useCallback((updated: SelectableTrack[]) => {
    setTracks(updated);
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    const selected = tracks.filter((t) => t.selected);
    if (selected.length === 0) {
      setError("Select at least one song.");
      return;
    }
    
    setError(null);
    setCreatingPlaylist(true);
    
    try {
      const { embedUrl: url } = await createPlaylist(selected);
      setEmbedUrl(url);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Redirecting")) return;
      setError(e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      setCreatingPlaylist(false);
    }
  }, [tracks]);

  const hasTracks = tracks.length > 0;
  const selectedCount = tracks.filter((t) => t.selected).length;

  return (
    <>
      <AppBar position="top">
        <AppBarSection>PlaylistGenerator</AppBarSection>
      </AppBar>

      <main className="section-container">
        <section aria-labelledby="search-heading">
          <h2 id="search-heading" className="visually-hidden">
            Generate playlist
          </h2>
          
          <SearchForm
            onSubmit={handleSearch}
            disabled={loading}
            submitLabel={loading ? "Generating…" : "Generate"}
          />
        </section>

        <ErrorMessage duckDuckGoose={error} />

        {hasTracks && (
          <section
            aria-labelledby="results-heading"
            aria-describedby="results-desc"
          >
            <h2 id="results-heading">Your playlist</h2>
            <p id="results-desc" className="results-description">
              {selectedCount} of {tracks.length} songs selected. Uncheck any you
              want to exclude.
            </p>

            <PlaylistGrid tracks={tracks} onSelectionChange={handleSelectionChange} />

            <div className="action-buttons">
              <SearchForm
                onSubmit={handleSearch}
                disabled={loading}
                placeholder="Add more songs…"
                submitLabel="New search"
              />
              <Button
                themeColor="primary"
                onClick={handleCreatePlaylist}
                disabled={creatingPlaylist || selectedCount === 0}
                aria-busy={creatingPlaylist}
              >
                {creatingPlaylist ? "Creating…" : "Create Spotify playlist"}
              </Button>
            </div>
          </section>
        )}

        {embedUrl && (
          <section aria-labelledby="embed-heading">
            <h2 id="embed-heading">Your playlist</h2>
            <PlaylistEmbed embedUrl={embedUrl} className="playlist-embed" />
          </section>
        )}
      </main>
    </>
  );
}
