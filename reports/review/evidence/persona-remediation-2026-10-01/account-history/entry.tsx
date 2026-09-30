import React from "react"
import { createRoot } from "react-dom/client"
import { PlanAdaptationFlow } from "../../app/src/screens/plan-beta/PlanAdaptationFlow"
import { SessionExplanationEntry } from "../../app/src/screens/plan-beta/SessionExplanation"
import { OracleExplore } from "../../app/src/screens/OracleExplore"
import { PlanEvidenceHistoryNotice } from "../../app/src/components/PlanEvidenceHistoryNotice"
import { usePlanEvidenceHistory } from "../../app/src/hooks/usePlanEvidenceHistory"
import { buildOraclePersonalResult } from "../../app/src/domain/oracle-personal-result"
import { replacedReplanFixture } from "../../app/src/domain/execution-replan-lineage.test-fixture"
import { collectSessionExplanationEvidence } from "../../app/src/domain/session-explanation-evidence"
import { readArchivedOriginalPlans } from "../../app/src/domain/plan-beta-store"
import { accountPlanEntry, emptyAccountPlanDocument, materializeAccountPlan } from "../../app/src/domain/account/account-plan-document-schema"
import { setActiveLocalAccount } from "../../app/src/domain/account/local-journal-ownership"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../app/src/domain/account/account-journal-projection"
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "../../app/src/styles/app.css"
import "../../app/src/styles/plan-beta.css"
import "../../app/src/styles/compact-tabs.css"

const f = replacedReplanFixture(), doc = emptyAccountPlanDocument()
const current = accountPlanEntry({ state: f.state, evidence: null })
doc.data.currentPlanId = current.planId
doc.data.plans = [...f.archivedPlans.map(state => ({ ...accountPlanEntry({ state, evidence: null }), archivedAt: new Date().toISOString() })), current]
const view = { status: "READY", confirmedDocument: { ...doc, data: { ...doc.data, plans: [current] } },
  currentPlan: { kind: "read_only", planId: current.planId, packet: materializeAccountPlan(current) }, historyLoaded: false, historyStatus: "IDLE" }
let finish: ((ok: boolean) => void) | undefined, requests = 0
const announce = () => window.dispatchEvent(new Event("trainoracle:account-plans-changed"))
const host = window as unknown as Record<string, unknown>
host.__historyRuntime = { snapshot: () => structuredClone(view), loadHistory: () => {
  requests++; view.historyStatus = "LOADING"; announce()
  return new Promise<boolean>(resolve => { finish = ok => {
    if (ok) { view.confirmedDocument = doc; view.historyLoaded = true }
    view.historyStatus = ok ? "READY" : "FAILED"; announce(); resolve(ok)
  } })
} }
host.__historyCommands = { finish: (ok: boolean) => finish?.(ok), requests: () => requests }
setActiveLocalAccount("synthetic-browser-account")
resetAccountJournalProjection("synthetic-browser-account")
setAccountJournalProjectionStatus("synthetic-browser-account", "READY")
const page = new URLSearchParams(location.search).get("view") ?? "cycle"
const entries = [{ ...f.entries[0]!, activityOutcome: "COMPLETED" as const, planExecutionRelation: "AS_PLANNED" as const,
  rpe: 3, fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }]
const session = f.state.activePlan.sessions[0]!
function OracleFixture() {
  const history = usePlanEvidenceHistory(true)
  const result = buildOraclePersonalResult({ topicId: "focus", entries, planState: f.state, planHistory: history.history, athleteRecords: [], today: "2026-10-01" })
  return <OracleExplore topicId="focus" initialMode="personal" personalResult={result} onBack={() => {}} onSelectTopic={() => {}} onPersonalAction={() => {}}
    personalResultUnavailable={!history.journalReadComplete}
    historyNotice={<PlanEvidenceHistoryNotice status={history.status} onRetry={history.retry} />} />
}
createRoot(document.getElementById("root")!).render(<main style={{ padding: 16, maxWidth: 680, margin: "0 auto" }}>
  {page === "oracle" ? <OracleFixture /> : page === "detail" ? <SessionExplanationEntry session={session} initialTab="주기·기록"
    context={{ kind: "SAVED", plan: f.state.activePlan, generatedAt: f.state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence(entries, f.state, session, readArchivedOriginalPlans())} />
    : <PlanAdaptationFlow state={f.state} onLoadEntries={() => entries} onLoadPending={async () => null} />}
</main>)
