"use client";

import {
  Grid as KendoGrid,
  GridColumn,
  GridSelectionChangeEvent,
  GridHeaderSelectionChangeEvent,
  GridCellProps,
} from "@progress/kendo-react-grid";
import { setSelectedState } from "@progress/kendo-react-data-tools";
import { Tooltip } from "@progress/kendo-react-tooltip";
import type { SelectableTrack } from "../types/index";

export interface PlaylistResultsProps {
  tracks: SelectableTrack[];
  onSelectionChange: (tracks: SelectableTrack[]) => void;
}

function confidenceColor(score: number): string {
  if (score >= 80) return "var(--kendo-color-success, #4caf50)";
  if (score >= 55) return "var(--kendo-color-warning, #ff9800)";
  return "var(--kendo-color-error, #f44336)";
}

const ConfidenceCell = (props: GridCellProps) => {
  const track = props.dataItem as SelectableTrack;
  const score = track.confidence;
  if (score === undefined) return <td />;
  return (
    <td title={track.reason ?? ""} style={{ cursor: track.reason ? "help" : "default" }}>
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

  return (
    <Tooltip anchorElement="target" position="top" showCallout>
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
        <GridColumn field="year" title="Year" />
        {showConfidence && (
          <GridColumn
            field="confidence"
            title="Match"
            cells={{ data: ConfidenceCell }}
            sortable
          />
        )}
      </KendoGrid>
    </Tooltip>
  );
}
