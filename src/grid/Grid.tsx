"use client";

import {
  Grid as KendoGrid,
  GridColumn,
  GridSelectionChangeEvent,
  GridHeaderSelectionChangeEvent,
} from "@progress/kendo-react-grid";
import { setSelectedState } from "@progress/kendo-react-data-tools";
import type { SelectableTrack } from "../types";

export interface PlaylistGridProps {
  tracks: SelectableTrack[];
  onSelectionChange: (tracks: SelectableTrack[]) => void;
}

/**
 * Displays a selectable list of tracks. All rows are selectable by default.
 * Uses Kendo Grid with checkbox selection for accessibility.
 */
export default function PlaylistGrid({
  tracks,
  onSelectionChange,
}: PlaylistGridProps) {
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
      <GridColumn field="title" title="Title" />
      <GridColumn field="artist" title="Artist" />
      <GridColumn field="album" title="Album" />
      <GridColumn field="year" title="Year" width="80px" />
    </KendoGrid>
  );
}
