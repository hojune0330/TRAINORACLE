import React from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react"
import type { PlanSession } from "@impl/plan-generator/types"
import { GLOSSARY } from "../../domain/glossary"
import { EXPLANATION_SOURCES } from "../../domain/training-explanation-profiles"
import { explainSession, explanationProfile, type SessionExplanationContext } from "../../domain/session-explanation"
import type { SessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import { COMPARISON_LABELS } from "./PlanCycleEvidence"
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"
import { prescriptionLabel, sessionLabel, sessionExecution } from "./labels"
import { sessionPrescriptionSequence } from "../../domain/session-prescription-sequence"
import { PrescriptionStructure } from "./PrescriptionStructure"
import "../../styles/session-explanation.css"

type Props = {
  readonly session: PlanSession
  readonly context?: SessionExplanationContext
  readonly loadEvidence?: (session: PlanSession) => SessionExplanationEvidence | null
}
const TABS = ["방법", "이유·근거", "주기·기록"] as const
type Tab = typeof TABS[number]

export function SessionExplanationEntry(props: Props) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="session-explanation-entry">
      <p>{explanationProfile(props.session).purpose}</p>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <BookOpen aria-hidden="true" size={17} />
        훈련 방법과 이유
        <ChevronRight aria-hidden="true" size={16} />
      </button>
      {open && createPortal(<SessionExplanationReader {...props} onClose={() => setOpen(false)} />, document.body)}
    </div>
  )
}

function SessionExplanationReader({ session, context, loadEvidence, onClose }: Props & { readonly onClose: () => void }) {
  const [tab, setTab] = React.useState<Tab>("방법")
  const [expert, setExpert] = React.useState(false)
  const evidence = React.useMemo(() => {
    try { return loadEvidence?.(session) ?? null } catch { return null }
  }, [loadEvidence, session, context?.plan.candidateId, context?.generatedAt])
  const dialog = React.useRef<HTMLDialogElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([])
  const id = React.useId()
  const explanation = explainSession(session, context)
  const sequence = sessionPrescriptionSequence(session)
  const term = GLOSSARY[explanation.profile.termId]
  const evidenceMatches = evidence !== null && context?.kind === "SAVED"
    && evidence.candidateId === context.plan.candidateId && evidence.generatedAt === context.generatedAt
  const rows = evidenceMatches ? evidence.rows.filter((row) => row.plannedSessionId === evidence.sessionId) : []

  React.useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.showModal()
    return () => {
      document.body.style.overflow = previousOverflow
      opener?.focus({ preventScroll: true })
    }
  }, [])

  function selectTab(next: Tab) {
    setTab(next)
    content.current?.scrollTo({ top: 0, behavior: "instant" })
  }

  return (
    <dialog ref={dialog} className="session-explanation" aria-labelledby={`${id}-title`} onCancel={onClose}>
      <header className="session-explanation__header">
        <button type="button" className="session-explanation__back" onClick={onClose} aria-label="훈련 일정으로 돌아가기">
          <ArrowLeft size={21} aria-hidden="true" />
        </button>
        <div><small>{session.day}일차 · {session.slot === "AM" ? "오전" : "오후"}</small><h2 id={`${id}-title`}>{sessionLabel(session)}</h2></div>
        <label className="session-explanation__expert"><input type="checkbox" checked={expert} onChange={(event) => setExpert(event.target.checked)} />전문 보기</label>
      </header>
      <div className="session-explanation__tabs" role="tablist" aria-label="훈련 상세 구분">
        {TABS.map((item, index) => (
          <button key={item} ref={(node) => { tabs.current[index] = node }} type="button" role="tab"
            id={`${id}-tab-${index}`} aria-label={item} aria-controls={`${id}-panel`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1}
            onClick={() => selectTab(item)} onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3
                : event.key === "Home" ? 0 : event.key === "End" ? 2 : null
              if (next === null) return
              event.preventDefault()
              selectTab(TABS[next]!)
              tabs.current[next]?.focus()
            }}>{item === "방법" ? item : <><span>{item.split("·")[0]}</span><wbr /><span>·{item.split("·")[1]}</span></>}</button>
        ))}
      </div>
      <div ref={content} className="session-explanation__content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${TABS.indexOf(tab)}`} tabIndex={0}>
        {tab === "방법" && (
          <>
            <section className="session-explanation__method-flow"><h3>수행 순서</h3>
              <p className="session-explanation__metric">{sessionExecution(session)}</p>
              {session.prescription.kind === "PACE_TARGET" && <DetailedPrescriptionView prescription={session.prescription} variant="sequence-lead" />}
              {sequence !== null ? <PrescriptionStructure sequence={sequence} /> : <ol className="session-explanation__sequence">
                {explanation.components.map((component) => <li key={component.id}><strong>{component.label}</strong><span>{component.method}</span><small>{component.recovery}</small></li>)}
              </ol>}
              <p className="session-explanation__note">순서도예요. 칸의 길이는 운동 시간이나 에너지 비율을 뜻하지 않아요.</p>
              {context?.kind === "SAVED" && sequence !== null && (
                <p className="session-explanation__note">{session.prescription.kind === "PACE_TARGET" && session.prescription.sequence !== undefined
                  ? "계획을 만들 때 저장한 운동·회복 순서예요."
                  : "저장된 처방을 순서도로 보여드려요. 이전 계획에 새 훈련을 추가하지 않아요."}</p>
              )}
            </section>
            {session.prescription.kind === "RPE_TIME_RANGE" && session.role === "QUALITY" && <p className="session-explanation__notice">상세 반복·구간별 시간은 아직 정해지지 않은 RPE 안내예요. 총 시간을 고강도 본운동 시간으로 사용하지 마세요.</p>}
            <button className="session-explanation__next" type="button" onClick={() => selectTab("이유·근거")}>이렇게 구성한 이유<ChevronRight size={18} aria-hidden="true" /></button>
          </>
        )}
        {tab === "이유·근거" && (
          <>
            <p className="session-explanation__notice">{explanation.availability}</p>
            <section><h3>훈련 목적</h3><p>{explanation.profile.purpose}</p></section>
            <section><h3>몸이 에너지를 공급하는 방식</h3><p>{explanation.profile.energyContext}</p>
              <details className="session-explanation__term"><summary>{term.label}은 왜 이런 이름인가요?</summary>
                <p>{term.namingOrigin ?? term.short}</p><p>{term.technicalDefinition ?? term.detail}</p>
                {term.notMeaning && <p>{term.notMeaning}</p>}
                {expert && <p>{term.pathwayContext}</p>}
                <a href={`?terms=1&term=${explanation.profile.termId}`} target="_blank" rel="noopener noreferrer">용어집에서 더 읽기 (새 탭)</a>
              </details>
            </section>
            <section><h3>거리·시간·강도·반복을 이렇게 정한 이유</h3><p>{explanation.work}</p></section>
            <section><h3>회복을 이렇게 넣은 이유</h3><p>{explanation.recovery}</p></section>
            {explanation.components.filter((component) => component.id !== "main" && component.id !== "rest").map((component) => (
              <section key={component.id}><h3>{component.label}의 목적</h3><p>{component.purpose}</p><p>{component.rationale}</p><p>{component.recovery}</p>
                <details><summary>기대·한계와 확인할 점</summary><p>{component.expectation}</p><ul>{component.limitations.map((line) => <li key={line}>{line}</li>)}</ul><p>{component.observation}</p></details>
              </section>
            ))}
            <section><h3>이번 주기에서 맡는 역할</h3>{explanation.cycle.map((line) => <p key={line}>{line}</p>)}</section>
            <section><h3>기대하는 변화와 한계</h3><p>{explanation.profile.expectedAdaptation}</p><ul>{explanation.limitations.map((line) => <li key={line}>{line}</li>)}</ul><p>{explanation.profile.observationGuide}</p></section>
            <section><h3>실제로 사용한 내 정보</h3>{explanation.inputs.length === 0 ? <p>개인 경기 기록을 이용한 계산은 적용하지 않아요.</p> : explanation.inputs.map((line) => <p key={line}>{line}</p>)}<p>일지 원문과 비밀 메모는 설명에 사용하거나 외부로 보내지 않아요.</p></section>
            <section><h3>연구·코칭 근거</h3><p>공통 원리를 설명하는 자료예요. 자료의 존재가 이 선수에게 이 횟수·페이스가 최적이라는 증거는 아니에요.</p>
              {explanation.templateContent !== null && <div className="session-explanation__template-source">
                <h4>이 훈련 구성의 채택 근거</h4>
                <p>일반 연구와 별도로 정한 거리·횟수·회복의 출처와 변경 내역이에요. 독립적인 과학 검토 완료를 뜻하지는 않아요.</p>
                <a href={`https://github.com/hojune0330/TRAINORACLE/blob/main/${explanation.templateContent.sourceRecordPath}`} target="_blank" rel="noopener noreferrer">원자료와 트레인오라클 구성의 차이</a>
                <a href={`https://github.com/hojune0330/TRAINORACLE/blob/main/${explanation.templateContent.decisionPath}`} target="_blank" rel="noopener noreferrer">현재 구성의 채택 기록</a>
                <small>템플릿 설명 버전 {explanation.templateContent.version}</small>
              </div>}
              <ul className="session-explanation__sources">{explanation.sourceIds.map((sourceId) => {
                const source = EXPLANATION_SOURCES[sourceId]
                if (source === undefined) return <li key={sourceId}>자료 연결을 확인할 수 없어요.</li>
                return <li key={sourceId}><strong>{source.kind === "MECHANISM_STUDY" ? "기전 연구" : source.kind === "TRAINING_STUDY" ? "훈련 효과 연구" : "코칭 설계"}</strong>
                  {source.url ? <a href={source.url.startsWith("https://") ? source.url : `https://github.com/hojune0330/TRAINORACLE/blob/main/${source.url}`} target="_blank" rel="noopener noreferrer">{source.title}</a> : <span>{source.title}</span>}
                  <p>대상: {source.population}</p><p>적용 범위: {source.applicability}</p>
                </li>
              })}</ul>
              <small>설명 버전 {explanation.version} · 근거 확인과 개별 처방 채택은 별도 검토예요.</small>
              {expert && explanation.template !== null && <p className="session-explanation__note">템플릿 {explanation.template.id} · 버전 {explanation.template.version}<br />채택 결정 {explanation.template.decision}</p>}
            </section>
          </>
        )}
        {tab === "주기·기록" && (
          <>
            <section><h3>주기 안의 위치</h3><ol>{explanation.cycle.map((line) => <li key={line}>{line}</li>)}</ol></section>
            {explanation.currentFrameLabel !== null && <section><h3>현재 장기 계획 연결</h3><p>{explanation.currentFrameLabel}</p></section>}
            <section><h3>계획한 자극</h3><p>{explanation.profile.purpose}</p><p>{prescriptionLabel(session)}</p></section>
            <section><h3>실제 기록</h3>{!evidenceMatches ? <p>이 화면에서는 현재 훈련과 연결된 일지를 확인하지 못했어요. 조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요.</p> : rows.length === 0 ? <p>이 훈련과 연결된 일지가 아직 없어요. 미기록을 0이나 훈련 실패로 계산하지 않아요.</p> : rows.map((row) => (
              <div key={row.plannedSessionId}><p>{row.date} · {row.slot === "AM" ? "오전" : "오후"}</p><p>{row.actualRpe === null ? "비교할 수 있는 RPE 미기록" : `직접 기록한 RPE ${row.actualRpe}`}</p><p>{COMPARISON_LABELS[row.comparison]}</p></div>
            ))}</section>
            <section><h3>관찰할 변화</h3><p>{explanation.profile.observationGuide}</p><p>계획의 자극과 실제 수행은 다를 수 있어요. 한 번의 기록이나 특정 훈련 횟수만으로 능력 부족·향상 원인·다음 경기 성적을 판단하지 않아요.</p><p>다음 주기에도 같은 방법을 선택할 수 있어요. 기록이 쌓였다는 이유만으로 강도·양·횟수를 자동으로 올리지 않아요.</p></section>
          </>
        )}
      </div>
    </dialog>
  )
}
