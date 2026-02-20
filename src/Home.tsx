"use client"

import {
  AppBar,
  AppBarSection,
} from "@progress/kendo-react-layout";

import "./Home.css";
import PlaylistGrid from "./grid/Grid";
import React from "react";

export default function Home() {

const [aiPlaylistReturned, setAiPlaylistReturned] = React.useState(true); 

  return (
    <>
      <AppBar position="top">
        <AppBarSection>PlaylistGenerator</AppBarSection>
      </AppBar>

      <section className="section-container">
        { aiPlaylistReturned && 
           <PlaylistGrid/>
         }
      </section>
    </>
  )
}
