import { ArrowLeft, Check, ShieldCheck } from "lucide-react"
import type {
  PlanCandidate,
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import {
  candidateSessionSummary,
  CANDIDATE_LABELS,
  EVENT_LABELS,
} from "./labels"
import { PlanSessionDetails } from "./PlanSessionDetails"

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
      <div className="plan-eyebrow">베타 계획 2가지</div>
      <div className="plan-heading-row">
        <h1 id="plan-candidates-title">두 계획에서 하나를 골라보세요</h1>
        <TermHelp term="plan-option" />
      </div>
      <p className="plan-copy">
        {generated.sourceMode === "PROFILE_ONLY"
          ? "종목, 경험, 가능한 훈련일, 계획 길이만 사용했어요. 개인 페이스와 최근 훈련량은 추정하지 않습니다."
          : "최근 일지가 있는지만 확인했어요. 일지의 거리, RPE, 메모는 이번 베타 계획의 시간이나 강도를 바꾸지 않습니다."}
      </p>
      <div className="plan-source-strip">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>
          <strong>
            {generated.sourceMode === "PROFILE_ONLY"
              ? "사용 정보 4가지 · 베타 계획"
              : "최근 일지 확인 · 계획 수치에는 미반영"}
            <TermHelp term="plan-beta-basis" />
          </strong>
          <small>시간과 RPE만 계산한 베타 계획 · 진단이나 의료 허가가 아님</small>
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
  const optionNumber = candidate.kind === "BALANCED" ? 1 : 2
  return (
    <article className="plan-candidate" aria-labelledby={`candidate-${candidate.candidateId}`}>
      <header>
        <span>계획 {optionNumber}</span>
        <h2 id={`candidate-${candidate.candidateId}`}>{label.title}</h2>
        <p>{label.detail}</p>
        <strong className="plan-candidate-summary">
          {candidateSessionSummary(candidate)}
        </strong>
        <small>
          {EVENT_LABELS[candidate.eventGroup].title} · {candidate.frame.lengthDays}일
          {" · "}훈련일마다 총 시간과 RPE 표시
        </small>
        <div className="plan-session-legend" aria-label="훈련 수치와 의도 설명">
          <span>RPE<TermHelp term="rpe" /></span>
          <span>BASE<TermHelp term="base" /></span>
          <span>조절 강도<TermHelp term="quality-session" /></span>
        </div>
      </header>
      <ol className="plan-session-list">
        {candidate.sessions.map((session) => (
          <li key={session.day}>
            <span>DAY {session.day}</span>
            <PlanSessionDetails session={session} />
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
