"use client";

import {
  Grid as KendoGrid,
  GridColumn,
  GridSelectionChangeEvent,
  GridHeaderSelectionChangeEvent,
  GridCellProps,
} from "@progress/kendo-react-grid";
import { setSelectedState } from "@progress/kendo-react-data-tools";
import type { SelectableTrack } from "../types/index";
import "./PlaylistResults.css";

export interface PlaylistResultsProps {
  tracks: SelectableTrack[];
  onSelectionChange: (tracks: SelectableTrack[]) => void;
}

function confidenceColor(score: number): string {
  if (score >= 80) return "var(--kendo-color-success, #4caf50)";
  if (score >= 55) return "var(--kendo-color-warning, #ff9800)";
  return "var(--kendo-color-error, #f44336)";
}

const TrackCell = (props: GridCellProps) => {
  const track = props.dataItem as SelectableTrack;
  const hasArtist = track.artist?.trim();
  const hasAlbum = track.album?.trim();
  const hasYear = typeof track.year === "number";
  const metaParts = [hasArtist && track.artist, hasAlbum && track.album, hasYear && String(track.year)].filter(Boolean);
  const meta = metaParts.join(" · ");

  return (
    <td className="track-cell-td">
      <div className="track-cell">
        <div className="track-cell-title">{track.title}</div>
        {meta && (
          <div className="track-cell-meta">{meta}</div>
        )}
      </div>
    </td>
  );
};

const ReasonCell = (props: GridCellProps) => {
  const track = props.dataItem as SelectableTrack;
  const reason = track.reason?.trim();
  if (!reason) return <td />;
  return (
    <td
      style={{
        fontSize: "0.875rem",
        color: "var(--kendo-color-subtle, #666)",
        lineHeight: 1.4,
      }}
    >
      {reason}
    </td>
  );
};

const ConfidenceCell = (props: GridCellProps) => {
  const track = props.dataItem as SelectableTrack;
  const score = track.confidence;
  if (score === undefined) return <td />;
  return (
    <td>
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "0.75rem",
          fontWeight: 600,
          background: confidenceColor(score),
          color: "#fff",
        }}
      >
        {score}%
      </span>
    </td>
  );
};

/**
 * Displays a selectable list of tracks. All rows are selectable by default.
 * Uses Kendo Grid with checkbox selection for accessibility.
 */
export default function PlaylistResults({
  tracks,
  onSelectionChange,
}: PlaylistResultsProps) {
  const handleSelectionChange = (event: GridSelectionChangeEvent) => {
    const updated = setSelectedState({
      data: [...tracks],
      selectedState: event.select,
      dataItemKey: "id",
      selectedField: "selected",
    }) as SelectableTrack[];
    onSelectionChange(updated);
  };

  const handleHeaderSelectionChange = (event: GridHeaderSelectionChangeEvent) => {
    const updated = setSelectedState({
      data: [...tracks],
      selectedState: event.select,
      dataItemKey: "id",
      selectedField: "selected",
    }) as SelectableTrack[];
    onSelectionChange(updated);
  };

  if (tracks.length === 0) return null;

  const showConfidence = tracks.some((t) => t.confidence !== undefined);
  const showReason = tracks.some((t) => t.reason?.trim());

  return (
    <KendoGrid
      data={tracks}
      dataItemKey="id"
      selectedField="selected"
      selectable={{
        enabled: true,
        mode: "multiple",
        drag: false,
        cell: false,
      }}
      onSelectionChange={handleSelectionChange}
      onHeaderSelectionChange={handleHeaderSelectionChange}
      sortable
      style={{ maxHeight: "50rem" }}
      aria-label="Playlist tracks. Use checkboxes to include or exclude songs."
    >
      <GridColumn
        field="selected"
        title="Include"
        width="80px"
        filterable={false}
        sortable={false}
        headerSelectionValue={tracks.every((t) => t.selected)}
      />
      <GridColumn
        field="title"
        title="Track"
        cells={{ data: TrackCell }}
      />
      {showReason && (
        <GridColumn
          field="reason"
          title="Why it matches"
          cells={{ data: ReasonCell }}
          sortable={false}
        />
      )}
      {showConfidence && (
        <GridColumn
          field="confidence"
          title="Match"
          width="120px"
          cells={{ data: ConfidenceCell }}
          sortable
        />
      )}
    </KendoGrid>
  );
}
