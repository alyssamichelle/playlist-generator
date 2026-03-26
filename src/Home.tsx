import { AppBar, AppBarSection } from "@progress/kendo-react-layout";
import { Button } from "@progress/kendo-react-buttons";
import { Switch } from "@progress/kendo-react-inputs";
import { Loader, Skeleton } from "@progress/kendo-react-indicators";
import { useState, useCallback, useEffect } from "react";

import "./Home.css";
import SearchForm from "./components/SearchForm";
import PlaylistResults from "./components/PlaylistResults";
import PlaylistEmbed from "./components/PlaylistEmbed";
import PlaylistActions from "./components/PlaylistActions";
import {
  generateTracks,
  resolveTracksWithSpotify,
  createPlaylist,
  getSpotifyStatus,
  spotifyAuthUrl,
  consumeSpotifyTokenFromUrl,
  getUserPlaylists,
} from "./api/client";
import type { SpotifyStatus, SpotifyPlaylist } from "./api/client";
import type { Track } from "./types";

/** Fallback when the API does not return playlistTitle (older models / parse quirks). */
function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const max = 72;
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

const ErrorMessage = ({ message }: { message: string | null }) => {
  if (!message) return null;
  return (
    <div role="alert" className="error-message" aria-live="polite">
      {message}
    </div>
  );
};

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectMap, setSelectMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus>({ authenticated: false });
  const [spotifyStatusLoading, setSpotifyStatusLoading] = useState(true);
  const [appendMode, setAppendMode] = useState(false);
  const [playlistMode, setPlaylistMode] = useState<"new" | "existing">("new");
  const [playlistName, setPlaylistName] = useState("");
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);

useEffect(() => {
  const init = async () => {
    consumeSpotifyTokenFromUrl(); // store token from URL

    try {
      // Always check status — backend returns company auth when configured, even without user token
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);

      if (status.authenticated) {
        try {
          const playlists = await getUserPlaylists();
          setUserPlaylists(playlists);
          if (playlists.length > 0) setSelectedPlaylist(playlists[0]);
        } catch (err) {
          console.error("Failed to fetch playlists:", err);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSpotifyStatusLoading(false);
    }
  };

  init();
}, []);

  const handleSearch = useCallback(async (prompt: string) => {
    setError(null);
    setEmbedUrl(null);
    setLoading(true);
    try {
      const { tracks: generated, playlistTitle } = await generateTracks(prompt);
      const newTracks = await resolveTracksWithSpotify(generated);
      if (appendMode) {
        setTracks((prev) => [...prev, ...newTracks]);
        setSelectMap((prev) => {
          const next = { ...prev };
          for (const t of newTracks) next[t.id] = true;
          return next;
        });
      } else {
        setTracks(newTracks);
        setSelectMap(Object.fromEntries(newTracks.map((t) => [t.id, true])));
      }
      const suggestedName = playlistTitle?.trim() || titleFromPrompt(prompt);
      setPlaylistName((prev) => {
        if (!appendMode) return suggestedName;
        return prev.trim() ? prev : suggestedName;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate songs");
    } finally {
      setLoading(false);
    }
  }, [appendMode]);

  const handleSelectionChange = useCallback((nextSelectMap: Record<string, boolean>) => {
    setSelectMap(nextSelectMap);
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    const selected = tracks.filter((t) => !!selectMap[t.id]);
    if (selected.length === 0) {
      setError("Select at least one song.");
      return;
    }

    setError(null);
    setCreatingPlaylist(true);
    try {
      const existingId = playlistMode === "existing" ? (selectedPlaylist?.id ?? undefined) : undefined;
      const { embedUrl: url } = await createPlaylist(
        selected,
        playlistMode === "new" ? (playlistName.trim() || undefined) : undefined,
        existingId,
      );
      setEmbedUrl(url);
      setPlaylistName("");
      setSelectedPlaylist(userPlaylists[0] ?? null);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Redirecting")) return;
      setError(e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      setCreatingPlaylist(false);
    }
  }, [tracks, selectMap, playlistMode, selectedPlaylist, playlistName, userPlaylists]);

  const hasTracks = tracks.length > 0 && !embedUrl;
  const selectedCount = tracks.reduce((count, t) => count + (selectMap[t.id] ? 1 : 0), 0);

  return (
    <>
      <AppBar position="top">
        <AppBarSection>
          <a href="/" className="appbar-logo" aria-label="Playlist Generator home">
            <img src="/favicon.png" alt="" className="appbar-logo-img" />
            <span>Playlist Generator</span>
          </a>
        </AppBarSection>
        <AppBarSection className="appbar-spacer" />
        <AppBarSection>
          {spotifyStatusLoading ? (
            <span className="spotify-status-loading" aria-busy="true">
              <Skeleton shape="text" style={{ width: "8rem", height: "2rem" }} />
            </span>
          ) : spotifyStatus.authenticated ? (
            <span className="spotify-status">
              {spotifyStatus.avatarUrl && (
                <img
                  src={spotifyStatus.avatarUrl}
                  alt={spotifyStatus.displayName ?? "Spotify user"}
                  className="spotify-avatar"
                />
              )}
              {spotifyStatus.displayName}
              {spotifyStatus.isCompanyAccount && (
                <Button
                  type="button"
                  fillMode="outline"
                  size="small"
                  onClick={() => { window.location.href = spotifyAuthUrl(); }}
                  className="use-your-spotify-btn"
                >
                  Use your Spotify
                </Button>
              )}
            </span>
          ) : (
            <Button
              type="button"
              themeColor="primary"
              onClick={() => { window.location.href = spotifyAuthUrl(); }}
            >
              Connect Spotify
            </Button>
          )}
        </AppBarSection>
      </AppBar>

      <main className="section-container">
        <section aria-labelledby="search-heading">
          <h2 id="search-heading" className="visually-hidden">Generate playlist</h2>

          <SearchForm
            onSubmit={handleSearch}
            disabled={loading}
            submitLabel={loading ? "Generating…" : "Generate"}
          />

          {!hasTracks && !loading && spotifyStatus.authenticated && userPlaylists.length > 0 && (
            <>
              <h3>Recently Generated Playlists</h3>
              <div className="flex-layout">
                {userPlaylists.slice(0, 3).map((playlist) => (
                  <div key={playlist.id}>
                    <PlaylistEmbed embedUrl={`https://open.spotify.com/embed/playlist/${playlist.id}`} />
                  </div>
                ))}
              </div>
            </>
          )}

          {hasTracks && (
            <label className="append-toggle">
              <Switch
                checked={appendMode}
                onChange={(e) => setAppendMode(e.value)}
                size="small"
              />
              <span>{appendMode ? "Add to results" : "Replace results"}</span>
            </label>
          )}
        </section>

        <ErrorMessage message={error} />

        {loading && (
          <div className="skeleton-list" aria-label="Generating songs…" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <Skeleton shape="text" style={{ width: "3ch" }} />
                <Skeleton shape="text" style={{ flex: 2 }} />
                <Skeleton shape="text" style={{ flex: 3 }} />
                <Skeleton shape="text" style={{ flex: 2 }} />
                <Skeleton shape="text" style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        )}

        {hasTracks && (
          <section aria-labelledby="results-heading" aria-describedby="results-desc">
            <h2 id="results-heading" className="visually-hidden">Your playlist</h2>
            <p id="results-desc" className="results-description">
              {selectedCount} of {tracks.length} songs selected. Uncheck any you want to exclude.
            </p>

            <PlaylistResults
              tracks={tracks}
              selectMap={selectMap}
              onSelectionChange={handleSelectionChange}
            />

            <PlaylistActions
              spotifyAuthed={spotifyStatus.authenticated}
              isCompanyAccount={spotifyStatus.isCompanyAccount}
              playlistMode={playlistMode}
              onPlaylistModeChange={setPlaylistMode}
              playlistName={playlistName}
              onPlaylistNameChange={setPlaylistName}
              userPlaylists={userPlaylists}
              selectedPlaylist={selectedPlaylist}
              onSelectedPlaylistChange={setSelectedPlaylist}
              onSubmit={handleCreatePlaylist}
              isSubmitting={creatingPlaylist}
              selectedCount={selectedCount}
            />
          </section>
        )}

        {embedUrl && (
          <section aria-labelledby="embed-heading">
            <h2 id="embed-heading" className="visually-hidden">Your playlist</h2>
            <PlaylistEmbed embedUrl={embedUrl} className="playlist-embed" />
          </section>
        )}

        {creatingPlaylist && (
          <div className="creating-overlay" aria-live="polite" aria-busy="true">
            <Loader size="large" type="converging-spinner" />
            <p>
              {playlistMode === "existing"
                ? "Finding tracks and adding to your playlist…"
                : "Finding tracks and building your playlist…"}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
