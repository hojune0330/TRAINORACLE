import React from "react"
import { createRoot } from "react-dom/client"
import { PlanMethodPicker } from "../../src/screens/plan-beta/PlanMethodPicker"
import { resolveDetailedPlanTemplateOptions } from "../../src/screens/plan-beta/plan-template-options"
import type { PlanBetaIntake } from "../../src/domain/plan-beta-store"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/plan-beta.css"

const first = resolveDetailedPlanTemplateOptions({ eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" }, "2026-09-27T03:00:00Z", [])[0]!
// This alternate is UI test data only. It is never added to operating registries.
const sequence = first.sequence!
const group = sequence.main[0]!
if (group.kind !== "group" || group.children[0]?.kind !== "segment") throw Error("FIXTURE_SHAPE_CHANGED")
const alternative = { ...first, ref: { ...first.ref, templateId: "TEST-ONLY-ALTERNATIVE" }, mainSummary: "2분 달리기 5회",
  preparationSummary: "화면 검수용 가상 구성입니다. 실제 훈련 지시가 아닙니다.",
  sequence: { ...sequence, main: [{ ...group, children: [{ ...group.children[0], work: { kind: "duration" as const, durationSeconds: 120, distanceM: null } }] }] } }
function Fixture() {
  const [selected, setSelected] = React.useState<PlanBetaIntake["selectedDetailedTemplateRef"]>(first.ref)
  const [pending, setPending] = React.useState(false)
  const [applies, setApplies] = React.useState(0)
  return <main className="plan-beta-screen"><h1>합성 훈련 선택 검수</h1>
    <PlanMethodPicker options={[first, alternative]} selected={selected} onPendingChange={setPending}
      onChange={ref => { setSelected(ref); setApplies(value => value + 1) }} />
    <output data-testid="applies">변경 요청 {applies}회</output><button disabled={pending}>계획 선택 확인</button>
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
