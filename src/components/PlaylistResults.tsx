"use client";

import {
  Grid as KendoGrid,
  GridColumn,
  GridSelectionChangeEvent,
  GridHeaderSelectionChangeEvent
} from "@progress/kendo-react-grid";
import type { Track } from "../types/index";
import "./PlaylistResults.css";

export interface PlaylistResultsProps {
  tracks: Track[];
  selectMap: Record<string, boolean>;
  onSelectionChange: (selectMap: Record<string, boolean>) => void;
}

/**
 * Displays a selectable list of tracks. All rows are selectable by default.
 * Uses Kendo Grid with checkbox selection for accessibility.
 */

export default function PlaylistResults({
  tracks,
  selectMap,
  onSelectionChange,
}: PlaylistResultsProps) {
  // Kendo expects `select` to be a `SelectDescriptor` shape: { [id: string]: boolean | number[] }.
  // For row selection we use boolean values.
  const selectState: Record<string, boolean> = selectMap;

  const handleSelectionChange = (event: GridSelectionChangeEvent) => {
    const next: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(event.select)) {
      next[id] = Array.isArray(value) ? value.length > 0 : !!value;
    }
    onSelectionChange(next);
  };

  const handleHeaderSelectionChange = (event: GridHeaderSelectionChangeEvent) => {
    // Use the event-provided `select` descriptor to avoid computing logic in two places.
    const next: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(event.select)) {
      next[id] = Array.isArray(value) ? value.length > 0 : !!value;
    }
    onSelectionChange(next);
  };

  if (tracks.length === 0) return null;

  const showConfidence = tracks.some((t) => t.confidence !== undefined);
  const showReason = tracks.some((t) => t.reason?.trim());

  return (
    <KendoGrid
      data={tracks}
      dataItemKey="id"
      select={selectState}
      selectable={{
        enabled: true,
        mode: "multiple",
        drag: false,
        cell: false,
      }}
      onSelectionChange={handleSelectionChange}
      onHeaderSelectionChange={handleHeaderSelectionChange}
      sortable={true}
      navigatable={true}
      style={{ maxHeight: "50rem" }}
      aria-label="Playlist tracks. Use checkboxes to include or exclude songs."
    >

      <GridColumn
        columnType="checkbox"
        title="Include"
        width="80px"
        filterable={false}
        sortable={false}
        headerSelectionValue={tracks.every((t) => !!selectMap[t.id])}
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
