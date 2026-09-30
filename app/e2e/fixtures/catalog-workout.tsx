import React from "react"
import { createRoot } from "react-dom/client"
import "../../../colors_and_type.css"
import "../../src/styles/app.css"
import "../../src/screens/log-entry/planned-repetition-editor.css"
import { CatalogWorkoutPicker } from "../../src/screens/plan-beta/CatalogWorkoutPicker"
import { PlannedSegmentEditor } from "../../src/screens/log-entry/PlannedSegmentEditor"
import { generatePlanFromDraft, selectPlanForActivation } from "../../src/domain/plan-beta-flow"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "../../src/domain/athlete-records"
import { createPlannedSessionLogDraft } from "../../src/domain/planned-session-link"
import { linkedCatalogWorkout } from "../../src/domain/planned-segment-evidence"
import type { ExerciseLog } from "../../src/domain/exercise-log"
import { parsePlanBetaState } from "../../src/domain/plan-beta-schema"

const now = new Date("2026-09-30T03:00:00Z")
const record = createSelfReportedAthleteRecord({ id: "catalog-browser-5k", purpose: "RECENT_RESULT", eventDistanceM: 5000,
  performanceSeconds: 1111.7, achievedOn: "2026-09-01", seasonId: null }, now)!
saveAthleteRecord(record, now)
const initial = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand: "EXPERIENCED",
  availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
  selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
if (initial.kind !== "generated") throw Error(initial.kind)
const source = initial
function Harness() {
  const [generated, setGenerated] = React.useState(source.generated)
  const [value, setValue] = React.useState<ExerciseLog>({ version: 1, source: "SELF_REPORTED", components: [] })
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, source.gate,
    { ...source.intake, startDate: "2026-09-30" }, source.athleteEvidence)
  const state = selected.kind === "selected" ? parsePlanBetaState(selected.state) : null
  const session = state?.activePlan.sessions.find(s => s.role === "QUALITY")
  const link = state && session ? createPlannedSessionLogDraft(state, session, now.toISOString())?.link : null
  const workout = link && session ? linkedCatalogWorkout(link, session) : null
  return <main style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}><h1>훈련 구성과 구간 기록</h1>
    <CatalogWorkoutPicker generated={generated} intake={source.intake} records={[record]} onChange={next => { setGenerated(next); setValue({ version: 1, source: "SELF_REPORTED", components: [] }) }} />
    {workout && link && <PlannedSegmentEditor workout={workout} link={link} value={value} onChange={setValue} />}
    <output data-testid="catalog-json" hidden>{JSON.stringify({ catalogId: workout?.catalogId, stored: !!state, value })}</output>
  </main>
}
createRoot(document.getElementById("root")!).render(<Harness />)
