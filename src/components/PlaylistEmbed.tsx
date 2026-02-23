"use client";

/**
 * Embeds a Spotify playlist iframe.
 * Follows Spotify embed guidelines and uses semantic iframe with title for accessibility.
 */
export interface PlaylistEmbedProps {
  /** The embed URL from Spotify (e.g. https://open.spotify.com/embed/playlist/...) */
  embedUrl: string;
  /** Optional class name for the wrapper. */
  className?: string;
}

export default function PlaylistEmbed({ embedUrl, className }: PlaylistEmbedProps) {
  return (
    <figure className={className} aria-label="Spotify playlist">
      <iframe
        src={embedUrl}
        title="Spotify playlist"
        width="100%"
        height="400"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </figure>
  );
}
