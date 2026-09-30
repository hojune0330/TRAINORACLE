import React from "react"
import { createRoot } from "react-dom/client"
import { PlanAdaptationFlow } from "../../app/src/screens/plan-beta/PlanAdaptationFlow"
import { SessionExplanationEntry } from "../../app/src/screens/plan-beta/SessionExplanation"
import { replacedReplanFixture } from "../../app/src/domain/execution-replan-lineage.test-fixture"
import { collectSessionExplanationEvidence } from "../../app/src/domain/session-explanation-evidence"
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "../../app/src/styles/app.css"
import "../../app/src/styles/plan-beta.css"
import "../../app/src/styles/compact-tabs.css"

const f = replacedReplanFixture()
const view = new URLSearchParams(location.search).get("view") ?? "cycle"
const entries = [{ ...f.entries[0]!, activityOutcome: "COMPLETED" as const, planExecutionRelation: "AS_PLANNED" as const,
  ...(view === "detail-changed" ? { activitySlot: "PM" as const, planExecutionRelation: "MODIFIED" as const } : {}),
  rpe: 3, fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }]
const history = { kind: "loaded" as const, plans: f.archivedPlans }
const session = f.state.activePlan.sessions.find(s => s.day === 1)!
const detail = view.startsWith("detail")
createRoot(document.getElementById("root")!).render(<main style={{ padding: 16, maxWidth: 680, margin: "0 auto" }}>
  <h1 style={{ fontSize: 20 }}>훈련 계획</h1>
  {detail ? <SessionExplanationEntry session={session} initialTab="주기·기록"
    context={{ kind: "SAVED", plan: f.state.activePlan, generatedAt: f.state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence(entries, f.state, session, history)} />
    : <PlanAdaptationFlow state={f.state} onLoadEntries={() => entries} onLoadHistory={() => history} onLoadPending={async () => null} />}
</main>)
