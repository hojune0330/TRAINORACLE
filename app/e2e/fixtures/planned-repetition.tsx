import React from "react"
import { createRoot } from "react-dom/client"
import { repetitionFixture, REPETITION_TEST_NOW } from "../../src/domain/planned-repetition.test-fixture"
import { selectPlanForActivation } from "../../src/domain/plan-beta-flow"
import { savePlanBetaState } from "../../src/domain/plan-beta-store"
import { createPlannedSessionLogDraft } from "../../src/domain/planned-session-link"
import { PlannedRepetitionEditor } from "../../src/screens/log-entry/PlannedRepetitionEditor"
import { comparePlannedRepetitions } from "../../src/domain/planned-repetition-evidence"
import type { ExerciseLog } from "../../src/domain/exercise-log"
import "../../../colors_and_type.css"
import "../../src/styles/app.css"

const f = repetitionFixture()
const selected = selectPlanForActivation(f.result.generated.candidates[0].candidateId, f.result.generated, f.result.gate,
  { ...f.result.intake, startDate: "2026-09-30" }, f.result.athleteEvidence, REPETITION_TEST_NOW)
if (selected.kind !== "selected" || !savePlanBetaState(selected.state).ok) throw Error("BROWSER_FIXTURE_PLAN_FAILED")
const session = selected.state.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")!
const link = createPlannedSessionLogDraft(selected.state, session, REPETITION_TEST_NOW.toISOString())!.link
function Harness() {
  const [value, setValue] = React.useState<ExerciseLog>({ version: 1, source: "SELF_REPORTED", components: [] })
  const comparison = value.plannedRepetitions ? comparePlannedRepetitions(value.plannedRepetitions, link, session) : null
  return <main style={{ maxWidth: 640, margin: "auto", padding: 16 }}>
    <h1 style={{ fontSize: 22 }}>훈련 후 기록</h1>
    <p>5×1000m @5000m RP · r150″ JOG</p>
    <PlannedRepetitionEditor entryId="browser-repetitions" date={link.plannedDate} link={link} value={value} onChange={setValue} />
    <output data-testid="repetition-json" hidden>{JSON.stringify(value)}</output>
    {comparison && <section aria-label="수행 비교"><h2 style={{ fontSize: 18 }}>남긴 기록과 계획</h2>
      <p>{comparison.facts[0]}</p><p>{comparison.interpretation}</p></section>}
  </main>
}
createRoot(document.getElementById("root")!).render(<Harness />)
