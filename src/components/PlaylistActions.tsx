import React from "react";
import { Button } from "@progress/kendo-react-buttons";
import { Input, RadioGroup } from "@progress/kendo-react-inputs";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { spotifyAuthUrl } from "../api/client";
import type { SpotifyPlaylist } from "../api/client";

interface PlaylistActionsProps {
  spotifyAuthed: boolean;
  isCompanyAccount?: boolean;
  playlistMode: "new" | "existing";
  onPlaylistModeChange: (mode: "new" | "existing") => void;
  playlistName: string;
  onPlaylistNameChange: (name: string) => void;
  userPlaylists: SpotifyPlaylist[];
  selectedPlaylist: SpotifyPlaylist | null;
  onSelectedPlaylistChange: (playlist: SpotifyPlaylist) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  selectedCount: number;
}

export default function PlaylistActions({
  spotifyAuthed,
  isCompanyAccount = false,
  playlistMode,
  onPlaylistModeChange,
  playlistName,
  onPlaylistNameChange,
  userPlaylists,
  selectedPlaylist,
  onSelectedPlaylistChange,
  onSubmit,
  isSubmitting,
  selectedCount,
}: PlaylistActionsProps) {
  return (
    <div className="action-buttons">
      {userPlaylists.length > 0 && !isCompanyAccount && (
        <RadioGroup
          data={[
            { label: "New playlist", value: "new" },
            { label: "Existing playlist", value: "existing" },
          ]}
          value={playlistMode}
          onChange={(e) => onPlaylistModeChange(e.value)}
          layout="horizontal"
          className="playlist-mode-radio"
        />
      )}

      {playlistMode === "new" ? (
        <Input
          value={playlistName}
          onChange={(e) => onPlaylistNameChange(e.value ?? "")}
          placeholder={`PlaylistGenerator – ${new Date().toLocaleDateString()}`}
          aria-label="Playlist name"
          className="playlist-name-input"
        />
      ) : (
        <DropDownList
          data={userPlaylists}
          value={selectedPlaylist}
          onChange={(e) => onSelectedPlaylistChange(e.value)}
          textField="name"
          dataItemKey="id"
          itemRender={(li, itemProps) => {
            const p: SpotifyPlaylist = itemProps.dataItem;
            return (
              <li {...(li.props as unknown as React.HTMLAttributes<HTMLLIElement>)}>
                <span className="playlist-dropdown-item">
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="playlist-dropdown-thumb" />}
                  <span className="playlist-dropdown-name">{p.name}</span>
                  <span className="playlist-dropdown-count">{p.trackCount} tracks</span>
                </span>
              </li>
            );
          }}
          className="playlist-name-input"
        />
      )}

      {spotifyAuthed ? (
        <Button
          type="button"
          themeColor="primary"
          onClick={onSubmit}
          disabled={isSubmitting || selectedCount === 0}
          aria-busy={isSubmitting}
        >
          {isSubmitting
            ? (playlistMode === "existing" ? "Updating…" : "Creating…")
            : (playlistMode === "existing"
              ? "Add to playlist"
              : isCompanyAccount
                ? "Add to our playlist"
                : "Create Spotify playlist")
          }
        </Button>
      ) : (
        <Button
          type="button"
          themeColor="primary"
          onClick={() => { window.location.href = spotifyAuthUrl(); }}
        >
          Connect Spotify
        </Button>
      )}
    </div>
  );
}
