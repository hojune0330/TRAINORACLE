import React from "react"
import { createRoot } from "react-dom/client"
import { AccountJournalStorageStatus } from "../../src/components/AccountJournalStorageStatus"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/account-auth.css"
import "./app-font.css"

export function mount() {
  const container = document.body.appendChild(document.createElement("main"))
  container.style.maxWidth = "920px"
  container.style.margin = "0 auto"
  createRoot(container).render(<AccountJournalStorageStatus />)
}
