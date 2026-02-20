"use client"

import {
    Grid,
    GridColumn
} from "@progress/kendo-react-grid";

import data from "./data.json";


export default function PlaylistGrid() {
    return (
      <> 
        <Grid
          id="playlist"
          sortable={true}
          filterable={true}
          data={data}
        >
          <GridColumn field="title" />
          <GridColumn field="artist"  />
          <GridColumn field="album" />
           <GridColumn field="year" />
        </Grid>
      </>
    );
}