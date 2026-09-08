import React from "react"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"
import { createRoot } from "react-dom/client"
import { PlanBeta } from "../../src/screens/PlanBeta"
import { Home } from "../../src/screens/Home"
import { JournalOriginalPlan } from "../../src/screens/journal/JournalOriginalPlan"
import { accountPlanService } from "../../src/domain/account/account-plan-service"
import { hydrateAccountJournalRecords } from "../../src/domain/account/account-journal-record-service"
import type { PlannedSessionLogDraft } from "../../src/domain/planned-session-link"
import type { PostSessionEntry } from "../../src/domain/journal-schema"
import { reserveJournalOwnership, setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"

export async function mount() {
  setActiveLocalAccount("11111111-1111-4111-8111-111111111111")
  await hydrateAccountJournalRecords()
  const service = accountPlanService()!
  await service.hydrate()
  const host = document.createElement("main"); document.body.append(host)
  const root = createRoot(host)
  let draft: PlannedSessionLogDraft | null = null
  const plan = () => root.render(<PlanBeta onWritePlannedSessionLog={value => { draft = value }} />)
  const home = () => root.render(<Home onOpenPlan={plan} />)
  const journal = () => {
    if (!draft) throw Error("No UI-produced journal link")
    const entry: PostSessionEntry = { id: "synthetic-linked-session", kind: "post-session", date: draft.link.plannedDate,
      savedAt: new Date().toISOString(), syncState: "local", title: "", system: "", memo: "", distanceKm: "",
      durationMin: "", avgPace: "", rpe: 0, activitySlot: draft.link.sessionSlot, plannedSessionLink: draft.link }
    reserveJournalOwnership([entry.id], "11111111-1111-4111-8111-111111111111")
    root.render(<JournalOriginalPlan entry={entry} />)
  }
  window.accountPlanUi = { service, plan, home, journal, draft: () => draft }
  plan()
}
declare global { interface Window { accountPlanUi: {
  service: NonNullable<ReturnType<typeof accountPlanService>>; plan: () => void; home: () => void; journal: () => void;
  draft: () => PlannedSessionLogDraft | null;
} } }
