import React from "react"
import { createRoot } from "react-dom/client"
import { JournalDecorationSurface } from "../../src/screens/journal/JournalDecorationSurface"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/journal-decoration.css"
import "../../src/styles/decoration-studio.css"

export function mount() {
  const root = createRoot(document.body.appendChild(document.createElement("main")))
  root.render(<JournalDecorationSurface date="2026-09-08" hasEntries>
    <article style={{ minHeight: 640, padding: 24 }}><h1>합성 훈련 일지</h1><p>캔버스 검수용 기록</p></article>
  </JournalDecorationSurface>)
}
