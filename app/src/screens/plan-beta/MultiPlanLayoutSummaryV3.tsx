import type { PlanSession } from "@impl/plan-generator/types"
import { compareMultiPlanLayoutV3 } from "../../domain/multi-plan-layout-summary-v3"
import { isoShift } from "../../domain/dates"
import { ENERGY_INTENT_LABELS } from "./labels"

type Session = Pick<PlanSession, "day" | "slot" | "role" | "plannedEnergyIntent">
export function MultiPlanLayoutSummaryV3({ before, after, startDate }: {
  readonly before: readonly Session[]; readonly after: readonly Session[]; readonly startDate: string;
}) {
  const summary = compareMultiPlanLayoutV3(before, after)
  const slot = (s: Session) => `${isoShift(startDate, s.day - 1)} ${s.slot === "AM" ? "오전" : "오후"}`
  return <section aria-label="조정 전후 훈련 배치" className="multi-plan-layout-summary">
    <h2>날짜와 훈련 횟수 확인</h2>
    <dl>
      <div><dt>운동 횟수</dt><dd>{summary.original.trainingSlots}회 → {summary.adjusted.trainingSlots}회</dd></div>
      <div><dt>주요 훈련 시간대</dt><dd>{summary.original.mainSlots.length}개 → {summary.adjusted.mainSlots.length}개</dd></div>
      <div><dt>하루 두 번 훈련하는 날</dt><dd>{summary.original.twoADayDays.length}일 → {summary.adjusted.twoADayDays.length}일</dd></div>
    </dl>
    <p>{summary.placementAndPurposeUnchanged ? "훈련 날짜·오전/오후·목적은 그대로예요." : "훈련 배치나 목적이 달라졌어요. 전체 일정을 확인해 주세요."}
      {" 횟수가 같아도 운동량·회복시간·부담은 달라질 수 있어요."}</p>
    <details><summary>주요 훈련 날짜 보기</summary><ul>{summary.adjusted.mainSlots.map(s =>
      <li key={`${s.day}:${s.slot}`}><strong>{slot(s)}</strong> · {ENERGY_INTENT_LABELS[s.plannedEnergyIntent].title}</li>)}</ul>
      <p>오전·오후 표시는 실제 시작 시각이나 충분한 회복을 보장하는 간격이 아니에요.</p>
    </details>
  </section>
}
