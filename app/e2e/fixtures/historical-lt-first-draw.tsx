import React from "react"
import { createRoot } from "react-dom/client"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { evaluatePlanSafety } from "../../src/domain/plan-beta-flow"
import { createPlanFormation } from "../../src/domain/plan-beta-formation"
import { LT_PILOT_MULTI_PLAN_RUNTIME_V3 } from "../../src/domain/lt-pilot-runtime-v3"
import { MultiAdjustedPlanEditFlowV3 } from "../../src/screens/plan-beta/MultiAdjustedPlanEditFlowV3"
import type { PlanBetaIntake } from "../../src/domain/plan-beta-store"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"
import "../../src/styles/training-content.css"

// The same historical core boundary as lt-pilot-runtime-v3.contract.test.tsx:
// never strip catalog bindings from current app plans or widen pilot authority.
const now = new Date("2026-09-28T12:00:00.000Z")
const intake: PlanBetaIntake = {
  eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "NOT_PROVIDED",
  experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
  trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
  trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null,
}
const safety = evaluatePlanSafety("NO_KNOWN_RISK", now)
if (safety.kind !== "passed") throw Error("Missing historical pilot safety gate")
const days = [1, 5, 9]
const generated = generatePlanCandidates({
  kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate: safety.gate,
  profile: { eventGroup: intake.eventGroup, eventDistanceM: intake.eventDistanceM,
    experienceBand: intake.experienceBand, availableTrainingDays: days,
    secondSessionMode: intake.secondSessionMode, trainingTimePreference: intake.trainingTimePreference },
  formation: createPlanFormation("2026-09-28", days, intake.experienceBand),
  requestedFrameLength: intake.requestedFrameLength, selectedEnergyIntent: intake.trainingFocus,
  selectedDetailedTemplateRef: intake.selectedDetailedTemplateRef,
  journalSource: safety.journalSource, selectionAuthority: "SELF",
})
if (generated.kind !== "generated") throw Error("Missing historical pilot candidate")
for (const candidate of generated.candidates) for (const session of candidate.sessions) {
  if (session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout !== undefined) {
    throw Error("Historical core fixture unexpectedly contains a current catalog binding")
  }
}
const entry = LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.({
  generated, gate: safety.gate, intake,
  athleteEvidence: { storedRecordCount: 0, goalRecordCount: 0, recentJournalSessionCount: 0 },
  currentCheck: "NO_KNOWN_RISK", candidateId: generated.candidates[0]!.candidateId, startDate: "2026-09-28",
})
if (!entry) throw Error("Missing exact approved historical LT pilot entry")
createRoot(document.getElementById("root")!).render(
  <main className="plan-beta" style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
    <MultiAdjustedPlanEditFlowV3 {...entry} isCurrentDraft={() => true}
      onSaved={() => { throw Error("This preview-only fixture must not save a plan") }} onCancel={() => {}} />
  </main>,
)
