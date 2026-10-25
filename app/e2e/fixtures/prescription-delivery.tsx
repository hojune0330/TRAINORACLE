import React from "react"
import { createRoot } from "react-dom/client"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"
import "../../src/styles/app-presentation.css"
import "../../src/styles/selection-system.css"
import { PlanSchedulePreview } from "../../src/screens/plan-beta/PlanSchedulePreview"
import { generatePlanFromDraft } from "../../src/domain/plan-beta-flow"
import { initializeCanonicalJournalBrowserFixture } from "./canonical-journal-browser"

await initializeCanonicalJournalBrowserFixture()
const events = [800, 1500, 3000, 5000, 10000, 21097, 42195] as const
function Harness() {
  const [eventDistanceM, setEvent] = React.useState<typeof events[number]>(5000)
  const result = React.useMemo(() => generatePlanFromDraft({ eventDistanceM,
    eventGroup: eventDistanceM <= 3000 ? "MIDDLE_DISTANCE" : eventDistanceM === 5000 ? "FIVE_K" : eventDistanceM === 10000 ? "TEN_K" : "GENERAL_ENDURANCE",
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY",
    requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null, startDate: "2026-10-25",
  }, "NO_KNOWN_RISK"), [eventDistanceM])
  if (result.kind !== "generated") throw Error(result.kind)
  const plan = result.generated.candidates[0]
  const main = plan.sessions.find(s => s.role === "QUALITY")!
  return <main className="plan-beta active-plan" style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
    <p>합성 계획 미리보기 · 저장하지 않음</p>
    <label>종목 <select aria-label="종목" value={eventDistanceM} onChange={e => setEvent(Number(e.target.value) as typeof eventDistanceM)}>
      {events.map(distance => <option key={distance} value={distance}>{distance === 21097 ? "하프" : distance === 42195 ? "마라톤" : `${distance}m`}</option>)}
    </select></label>
    <PlanSchedulePreview key={eventDistanceM} startDate="2026-10-25" frameLengthDays={9} sessions={plan.sessions}
      presentation="prescription-calendar" displayMode="swipe" showRpeGuide={false} focusSession={main}
      explanationContext={{ kind: "CANDIDATE", plan }} />
  </main>
}
createRoot(document.getElementById("root")!).render(<Harness />)
