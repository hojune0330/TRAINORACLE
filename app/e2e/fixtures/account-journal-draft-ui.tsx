import React from "react"
import { createRoot } from "react-dom/client"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { AccountJournalDraftPanel } from "../../src/screens/account/AccountJournalDraftPanel"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/account-auth.css"
import "./app-font.css"

const owner = "11111111-1111-4111-8111-111111111111"

export function mount() {
  setActiveLocalAccount(owner)
  const container = document.body.appendChild(document.createElement("main"))
  container.style.maxWidth = "920px"
  container.style.margin = "0 auto"
  container.style.padding = "18px 20px 90px"
  container.style.boxSizing = "border-box"
  createRoot(container).render(<AccountJournalDraftPanel userId={owner} />)
}
