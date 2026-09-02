import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { SessionExplanationEntry } from "./SessionExplanation"
import {
  ENERGY_INTENT_LABELS,
  prescriptionLabel,
  sessionGuidance,
  sessionIntentLabel,
  sessionLabel,
} from "./labels"

export function PlanSessionDetails({
  session,
}: {
  readonly session: PlanSession
}) {
  return (
    <div className="plan-session-content">
      <strong>{sessionLabel(session)}</strong>
      <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
        {prescriptionLabel(session)}
      </small>
      <SessionExplanationEntry session={session} />
      <span className="plan-session-intent">
        훈련 의도 ·{" "}
        <span className="plan-session-term">
          {sessionIntentLabel(session)}
          <TermHelp term={ENERGY_INTENT_LABELS[session.plannedEnergyIntent].term} />
        </span>
      </span>
      <details className="plan-session-guidance">
        <summary>실행 방법 보기</summary>
        <p>{sessionGuidance(session)}</p>
      </details>
    </div>
  )
}
