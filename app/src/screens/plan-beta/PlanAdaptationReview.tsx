import { ArrowLeft } from "lucide-react"
import type { PreparedNextFrameAdaptation } from "../../domain/plan-adaptation-ui"
import {
  recordPurposeLabel,
} from "../../domain/athlete-records"
import {
  prescriptionLabel,
  sessionLabel,
  sessionSlotLabel,
} from "./labels"

export function PlanAdaptationReview({
  prepared,
  busy,
  onAccept,
  onBack,
}: {
  readonly prepared: PreparedNextFrameAdaptation
  readonly busy: boolean
  readonly onAccept: () => void
  readonly onBack: () => void
}) {
  const selfSelectable = prepared.proposal.selectionAuthority === "SELF"
  return (
    <div className="plan-adaptation__review">
      <div className="plan-adaptation__step-head">
        <button className="plan-adaptation__back" type="button" aria-label="이전 단계" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h2>다음 계획 비교</h2>
      </div>
      <section aria-labelledby="adaptation-changed-title">
        <h3 id="adaptation-changed-title">바뀌는 것</h3>
        <ul className="plan-adaptation__changes">
          {prepared.changedSessions.map(({ before, after }) => (
            <li key={`${after.day}:${after.slot}`}>
              <strong>DAY {after.day} {sessionSlotLabel(after.slot)} · {sessionLabel(after)}</strong>
              <span className="plan-adaptation__change-copy">
                <AdaptationPrescriptionLabel value={prescriptionLabel(before)} />
                {" → "}
                <AdaptationPrescriptionLabel value={prescriptionLabel(after)} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="adaptation-same-title">
        <h3 id="adaptation-same-title">그대로인 것</h3>
        <p>훈련 날짜와 세션 역할, 선택한 훈련 의도, 현재 활성 계획과 진행 기록은 그대로예요.</p>
      </section>
      <section aria-labelledby="adaptation-source-title">
        <h3 id="adaptation-source-title">이유와 기록 출처</h3>
        <p>{prepared.reason === "PB_SB" && prepared.record !== null
          ? `${prepared.record.eventDistanceM}m ${recordPurposeLabel(prepared.record.purpose)} · ${prepared.record.achievedOn}에 저장된 구조화 기록`
          : "선수가 직접 요청한 다음 주기 조정"}</p>
      </section>
      <section aria-labelledby="adaptation-uncertainty-title">
        <h3 id="adaptation-uncertainty-title">불확실한 점</h3>
        <p>이 비교는 현재 제공할 수 있는 두 베타 계획안의 차이만 설명해요. 회복 상태나 경기 결과를 예측하지 않으며 현재 계획을 자동으로 바꾸지 않아요.</p>
      </section>
      {selfSelectable ? (
        <button className="plan-adaptation__accept" type="button" disabled={busy} onClick={onAccept}>
          이 다음 계획 선택하기
        </button>
      ) : (
        <p className="plan-adaptation__notice" role="status">
          이 계획안은 지도자 확인이 필요해요. 선수 화면에서는 적용할 수 없고 현재 계획은 그대로 유지됩니다.
        </p>
      )}
    </div>
  )
}

function AdaptationPrescriptionLabel({ value }: { readonly value: string }) {
  const parts = value.split(/(\d+~\d+분|기초 지구력 · BASE)/gu)
  return parts.map((part, index) => (
    /^(?:\d+~\d+분|기초 지구력 · BASE)$/u.test(part)
      ? <span className="plan-adaptation__metadata-token" key={`${part}:${index}`}>{part}</span>
      : part
  ))
}

export function PlanAdaptationResult({
  message,
  onClose,
}: {
  readonly message: string
  readonly onClose: () => void
}) {
  return (
    <div className="plan-adaptation__result">
      <h2>다음 계획 조정</h2>
      <p role="status">{message}</p>
      <button className="plan-adaptation__close" type="button" onClick={onClose}>현재 계획으로 돌아가기</button>
    </div>
  )
}
