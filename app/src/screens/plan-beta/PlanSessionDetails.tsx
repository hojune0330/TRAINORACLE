import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import {
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
      <span className="plan-session-intent">
        훈련 의도 ·{" "}
        {session.role === "REST" && sessionIntentLabel(session)}
        {session.role === "EASY" && (
          <span className="plan-session-term">
            {sessionIntentLabel(session)}
            <TermHelp term="base" />
          </span>
        )}
        {session.role === "QUALITY" && (
          <>
            <span className="plan-session-term">
              조절 강도
              <TermHelp term="quality-session" />
            </span>
            <span> · 세부 에너지 시스템 미지정</span>
          </>
        )}
      </span>
      <details className="plan-session-guidance">
        <summary>실행 방법 보기</summary>
        <p>{sessionGuidance(session)}</p>
      </details>
    </div>
  )
}
