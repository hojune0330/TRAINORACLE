import type { PlanSession } from "@impl/plan-generator/types"
import { planPrescriptionSupply } from "../../domain/plan-prescription-supply"
import type { InitialMainReview } from "../../domain/initial-main-conditions"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { sessionSlotLabel } from "./labels"
import "./PlanPrescriptionSupply.css"

const flagLabels = {
  detailed_applied: "상세 연결됨", confirmation_pending: "확인 대기", condition_needed: "조건 확인",
  input_needed: "입력 필요", time_rpe_guidance: "시간·힘든 정도", check_failed: "계산 확인 필요",
} as const

export function PlanPrescriptionSupply({ sessions, prescriptionBinding, confirmationPending = false, startDate, initialReview, verifiedDetailedSlots }: {
  readonly sessions: readonly PlanSession[]
  readonly prescriptionBinding?: { readonly kind?: string; readonly code?: string }
  readonly confirmationPending?: boolean
  readonly startDate?: string
  readonly initialReview?: Pick<InitialMainReview, "offers" | "fallbacks">
  readonly verifiedDetailedSlots?: readonly { readonly day: number; readonly slot: "AM" | "PM" }[]
}) {
  const slots = planPrescriptionSupply(sessions, { prescriptionBinding, confirmationPending, initialReview, verifiedDetailedSlots })
  if (!slots.length) return null
  const completedCount = slots.filter(item => item.flags.length === 1 && item.flags[0] === "detailed_applied").length
  const needsAttention = slots.filter(item => !(item.flags.length === 1 && item.flags[0] === "detailed_applied"))
  const dateLabel = (day: number) => startDate && isValidIsoDate(startDate) ? isoShift(startDate, day - 1) : `Day ${day}`
  return <section className="plan-prescription-supply" aria-labelledby="plan-prescription-supply-title">
    <h3 id="plan-prescription-supply-title">훈련별 확인할 내용</h3>
    {completedCount > 0 && <p className="plan-prescription-supply__success">주요 훈련 {completedCount}회에 상세 수치가 연결됐어요.</p>}
    {needsAttention.length > 0 && <ul className="plan-prescription-supply__list">
      {needsAttention.map(item => <li className="plan-prescription-supply__item" key={`${item.day}-${item.slot}`}>
        <div className="plan-prescription-supply__head">
          <strong>{dateLabel(item.day)} · {sessionSlotLabel(item.slot)}</strong>
          <span>{item.title}</span>
        </div>
        <div className="plan-prescription-supply__flags" aria-label="공급 상태">
          {item.flags.map(flag => <span className={`plan-prescription-supply__flag plan-prescription-supply__flag--${flag}`} key={flag}>{flagLabels[flag]}</span>)}
        </div>
        <p>{item.detail}</p>
      </li>)}
    </ul>}
  </section>
}
