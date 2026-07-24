import { ArrowLeft, Check, ShieldCheck } from "lucide-react"
import type {
  PlanCandidate,
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import {
  CANDIDATE_LABELS,
  EVENT_LABELS,
  prescriptionLabel,
  sessionLabel,
} from "./labels"

export function PlanCandidates({
  generated,
  onBack,
  onSelect,
}: {
  readonly generated: PlanGenerationSuccess
  readonly onBack: () => void
  readonly onSelect: (candidate: PlanCandidate) => void
}) {
  return (
    <section className="plan-candidates" aria-labelledby="plan-candidates-title">
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        질문 다시 보기
      </button>
      <div className="plan-eyebrow">TWO BETA OPTIONS</div>
      <h1 id="plan-candidates-title">두 후보를 비교해보세요</h1>
      <p className="plan-copy">
        {generated.sourceMode === "PROFILE_ONLY"
          ? "일지가 적어 최소 프로필만 사용했어요. 정확한 페이스를 만들지 않고 시간과 RPE 범위로 제안합니다."
          : "최근 14일에 일지가 있다는 사실만 표시했어요. 이번 베타 처방에는 일지 수치나 메모를 반영하지 않습니다."}
      </p>
      <div className="plan-source-strip">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>
          <strong>{generated.sourceMode === "PROFILE_ONLY" ? "프로필 기반 · 제한 신뢰도" : "일지 보유 · 처방 미반영"}</strong>
          <small>베타 제안 · 의료적 허가나 진단이 아님</small>
          {generated.candidates[0].continuityContext.kind ===
            "PREVIOUS_FRAME_CONTEXT_RETAINED" && (
            <small>
              지난 계획의 선택·진행 집계를 이어받음 · 자동 강도 상승 없음
            </small>
          )}
        </span>
      </div>
      <div className="plan-candidate-list">
        {generated.candidates.map((candidate) => (
          <CandidateSection
            key={candidate.candidateId}
            candidate={candidate}
            onSelect={() => onSelect(candidate)}
          />
        ))}
      </div>
    </section>
  )
}

function CandidateSection({
  candidate,
  onSelect,
}: {
  readonly candidate: PlanCandidate
  readonly onSelect: () => void
}) {
  const label = CANDIDATE_LABELS[candidate.kind]
  return (
    <article className="plan-candidate" aria-labelledby={`candidate-${candidate.candidateId}`}>
      <header>
        <span>{candidate.kind}</span>
        <h2 id={`candidate-${candidate.candidateId}`}>{label.title}</h2>
        <p>{label.detail}</p>
        <small>
          {EVENT_LABELS[candidate.eventGroup].title} · {candidate.frame.lengthDays}일
          {" · "}베타 공통 시간·RPE 범위
        </small>
      </header>
      <ol className="plan-session-list">
        {candidate.sessions.map((session) => (
          <li key={session.day}>
            <span>DAY {session.day}</span>
            <div>
              <strong>{sessionLabel(session)}</strong>
              <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
                {prescriptionLabel(session)}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <button className="plan-select-action" type="button" onClick={onSelect}>
        <Check aria-hidden="true" size={18} />
        {label.title} 선택하기
      </button>
    </article>
  )
}
