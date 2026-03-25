"use client";

import {
  Grid as KendoGrid,
  GridColumn,
  GridSelectionChangeEvent,
  GridHeaderSelectionChangeEvent
} from "@progress/kendo-react-grid";
import type { SelectableTrack } from "../types/index";
import "./PlaylistResults.css";

export interface PlaylistResultsProps {
  tracks: SelectableTrack[];
  onSelectionChange: (tracks: SelectableTrack[]) => void;
}

/**
 * Displays a selectable list of tracks. All rows are selectable by default.
 * Uses Kendo Grid with checkbox selection for accessibility.
 */

export default function PlaylistResults({
  tracks,
  onSelectionChange,
}: PlaylistResultsProps) {
  const handleSelectionChange = (event: GridSelectionChangeEvent) => {
    const updated = tracks.map((track) =>
      track.id === event.dataItem.id ? { ...track, selected: !track.selected } : track
    );
    onSelectionChange(updated);
  };

  const handleHeaderSelectionChange = (_event: GridHeaderSelectionChangeEvent) => {
    const allSelected = tracks.every((t) => t.selected);
    const newSelected = !allSelected;
    const updated = tracks.map((track) => ({ ...track, selected: newSelected }));
    onSelectionChange(updated);
  };

  if (tracks.length === 0) return null;

  const showConfidence = tracks.some((t) => t.confidence !== undefined);
  const showReason = tracks.some((t) => t.reason?.trim());
  const select = tracks.reduce<Record<string, boolean>>((acc, track) => {
    if (track.selected) acc[track.id] = true;
    return acc;
  }, {});

  return (
    <KendoGrid
      data={tracks}
      dataItemKey="id"
      select={select}
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
        sortable
      />
       <GridColumn
        field="artist"
        title="Artist"
        sortable
      />
      {showReason && (
        <GridColumn
          field="reason"
          title="Why it matches"
          sortable={false}
        />
      )}
      {showConfidence && (
        <GridColumn
          field="confidence"
          title="% Match"
          width="120px"
          sortable
        />
      )}
    </KendoGrid>
  );
}
