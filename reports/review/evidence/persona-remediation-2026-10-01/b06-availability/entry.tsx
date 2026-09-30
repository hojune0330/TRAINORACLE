import React from "react"
import { createRoot } from "react-dom/client"
import { PlanAdaptationFlow } from "../../app/src/screens/plan-beta/PlanAdaptationFlow"
import { replacedReplanFixture } from "../../app/src/domain/execution-replan-lineage.test-fixture"
import { stateFixture } from "../../app/src/domain/plan-beta-store.test-fixture"
import { generatePlanCandidates } from "../../impl/src/plan-generator/generator"
import { evaluatePlanSafety } from "../../app/src/domain/plan-beta-flow"
import { createPlanFormation } from "../../app/src/domain/plan-beta-formation"
import { savePlanAdaptationContext, adaptationScopeForCandidate } from "../../app/src/domain/plan-adaptation-ui-context"
import { savePlanBetaState } from "../../app/src/domain/plan-beta-store"
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "../../app/src/styles/app.css"
import "../../app/src/styles/plan-beta.css"
import "../../app/src/styles/compact-tabs.css"

const mode = new URLSearchParams(location.search).get("mode") ?? "changed"
const now = new Date("2026-08-18T12:00:00.000Z")
let state = mode === "changed" ? replacedReplanFixture().state : stateFixture()
if (mode === "supported") {
  const safety = evaluatePlanSafety("NO_KNOWN_RISK", now)
  if (safety.kind !== "passed") throw Error("Synthetic safety fixture")
  const days = [1, 3, 5, 7, 9]
  const generated = generatePlanCandidates({ kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate: safety.gate,
    profile: { eventGroup: "FIVE_K", eventDistanceM: 5000, experienceBand: "EXPERIENCED", availableTrainingDays: days,
      secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING" },
    formation: createPlanFormation("2026-08-18", days, "EXPERIENCED"), requestedFrameLength: 9,
    selectedEnergyIntent: "VO2_INTENT", journalSource: { kind: "NO_USABLE_JOURNAL" }, selectionAuthority: "SELF" })
  if (generated.kind !== "generated") throw Error("Synthetic generator fixture")
  const c = generated.candidates[0]
  state = { ...state, version: 3, generatedAt: now.toISOString(), adaptationScope: adaptationScopeForCandidate(c)!,
    intake: { ...state.intake, experienceBand: "EXPERIENCED", availableDayCount: 5, trainingFocus: "VO2_INTENT", trainingTimePreference: "MORNING", startDate: "2026-08-18" },
    activePlan: { ...state.activePlan, candidateId: c.candidateId, pairId: c.pairId, candidateKind: c.kind,
      eventDistanceM: c.eventDistanceM, selectedDetailedTemplateRef: c.selectedDetailedTemplateRef,
      selectionActor: "SELF", sourceMode: c.sourceMode, selectedEnergyIntent: c.selectedEnergyIntent, frame: c.frame, sessions: c.sessions } }
  if (!savePlanAdaptationContext(generated.candidates, c.candidateId).ok) throw Error("Synthetic context save")
  if (!savePlanBetaState(state).ok) throw Error("Synthetic active save")
}
createRoot(document.getElementById("root")!).render(
  <main style={{ padding: "16px", maxWidth: "680px", margin: "0 auto" }}>
    <h1 style={{ fontSize: "20px" }}>훈련 계획</h1>
    <PlanAdaptationFlow state={state} onLoadEntries={() => []} />
  </main>,
)
