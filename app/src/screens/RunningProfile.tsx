import React from "react"
import { AppHeading } from "../components/AppHeading"
import { ArrowLeft, ArrowRight, Check, ChevronRight, Pencil, RotateCcw, Trash2, X, Compass, Flag, Activity, Users } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { PROFILE_QUESTIONS, describeRunningPreferences, toggleProfileAnswer, type RunningProfileAnswers, type RunningProfileStage } from "../domain/running-profile"
import { createRunningProfileService, runningProfileEditToken, type RunningProfileStore } from "../domain/account/account-running-profile-service"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { registerUnsavedDraftGuard } from "../domain/unsaved-draft-navigation"
import { loadEntries } from "../domain/journal-store"
import { buildOraclePersonalResult, type OraclePersonalResult } from "../domain/oracle-personal-result"
import { useAthleteRecordsSnapshot } from "../hooks/useAthleteRecordsSnapshot"
import { usePlanEvidenceHistory } from "../hooks/usePlanEvidenceHistory"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import "./running-profile.css"

const SECTIONS = [
  { id: "preferences", label: "취향", icon: Compass }, { id: "records", label: "경기 기록", icon: Flag },
  { id: "training", label: "최근 훈련", icon: Activity }, { id: "changes", label: "변화", icon: Users },
] as const
export const isProfileResultStage = (stage: RunningProfileStage) => SECTIONS.some(section => section.id === stage)
const initialStore: RunningProfileStore = { status: "LOADING", document: null, revision: 0, sequence: 0, remote: null, remoteRevision: null }

export function RunningProfile({ stage, today, onStageChange, onBack, onClose }: {
  readonly stage: RunningProfileStage; readonly today: string
  readonly onStageChange: (stage: RunningProfileStage) => void
  readonly onBack: () => void; readonly onClose: () => void
}) {
  const owner = activeLocalAccount()
  const motion = useCalendarMotion()
  const [store, setStore] = React.useState<RunningProfileStore>(initialStore)
  const service = React.useRef<ReturnType<typeof createRunningProfileService> | null>(null)
  const [answers, setAnswers] = React.useState<RunningProfileAnswers>({})
  const dirty = React.useRef(false)
  const token = React.useRef<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [review, setReview] = React.useState<RunningProfileStore | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const recordSnapshot = useAthleteRecordsSnapshot()
  const journalHistory = usePlanEvidenceHistory(false)
  const questionIndex = PROFILE_QUESTIONS.findIndex(item => item.id === stage)
  const question = PROFILE_QUESTIONS[questionIndex]
  const description = describeRunningPreferences(answers)
  const resultStage = isProfileResultStage(stage)

  React.useEffect(() => {
    if (!owner) return
    if (!accountJournalPreviewEnabled()) { setStore({ ...initialStore, status: "FAILED" }); return }
    let alive = true
    try {
      const next = createRunningProfileService(owner, value => {
        if (!alive) return
        setStore(value)
        if (!dirty.current) {
          setAnswers(value.document?.data.answers ?? {})
          token.current = runningProfileEditToken(value)
        }
      })
      service.current = next
      void next.hydrate()
      const retryPending = () => {
        if (alive && !dirty.current && ["PENDING", "FAILED"].includes(next.snapshot().status)) void next.hydrate()
      }
      window.addEventListener("online", retryPending)
      window.addEventListener("focus", retryPending)
      return () => {
        alive = false; window.removeEventListener("online", retryPending); window.removeEventListener("focus", retryPending)
        next.close(); if (service.current === next) service.current = null
      }
    } catch { setStore({ ...initialStore, status: "FAILED" }) }
  }, [owner])

  React.useEffect(() => {
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => dirty.current,
      onBlocked: () => setMessage("아직 계정에 저장하지 않은 응답이 있어요."),
      confirmDiscard: () => window.confirm("저장하지 않은 응답을 지우고 나갈까요?"),
      discard: () => { dirty.current = false },
    })
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", beforeUnload)
    return () => { unregister(); window.removeEventListener("beforeunload", beforeUnload) }
  }, [])
  React.useEffect(() => { heading.current?.focus({ preventScroll: true }); setConfirmClear(false) }, [stage])

  const edit = (next: RunningProfileStage) => {
    if (!dirty.current) token.current = runningProfileEditToken(store)
    setMessage(null); onStageChange(next)
  }
  const finish = async (candidate: RunningProfileAnswers) => {
    if (busy) return
    setAnswers(candidate)
    if (!owner) {
      dirty.current = false; onStageChange("preferences"); return
    }
    const currentService = service.current
    if (!currentService || !["READY", "EMPTY"].includes(store.status)) {
      setMessage("계정 저장을 확인하지 못했어요. 응답은 이 화면에 남아 있어요.")
      onStageChange("preferences"); return
    }
    setBusy(true)
    const saved = await currentService.save(candidate, token.current ?? runningProfileEditToken(store))
    if (service.current !== currentService) return
    const snapshot = currentService.snapshot()
    const protectedDraft = JSON.stringify(snapshot.document?.data.answers) === JSON.stringify(candidate)
      && ["READY", "PENDING", "CONFLICT"].includes(snapshot.status)
    if (saved || protectedDraft) dirty.current = false
    if (saved) token.current = runningProfileEditToken(snapshot)
    if (!saved && snapshot.status === "READY" && token.current !== runningProfileEditToken(snapshot)) setReview(snapshot)
    setBusy(false)
    setMessage(saved ? "계정에 저장했어요." : protectedDraft ? "응답을 보관했어요. 계정 저장은 아직 완료되지 않았어요." : "저장하지 못했어요. 응답은 이 화면에 남아 있어요.")
    onStageChange("preferences")
  }
  const advance = (candidate: RunningProfileAnswers) => {
    if (questionIndex === 2 || questionIndex === PROFILE_QUESTIONS.length - 1) void finish(candidate)
    else onStageChange(PROFILE_QUESTIONS[questionIndex + 1]!.id)
  }
  const select = (value: string) => {
    if (!question || busy) return
    const next = toggleProfileAnswer(answers, question.id, value)
    dirty.current = true; setAnswers(next)
    if (!question.multiple) advance(next)
  }
  const retry = async () => {
    const currentService = service.current
    if (!currentService || busy) return
    setBusy(true); setMessage(null)
    await currentService.hydrate()
    if (service.current === currentService) setBusy(false)
  }
  const resolve = async (choice: "LOCAL" | "REMOTE") => {
    const currentService = service.current
    if (!currentService || busy) return
    setBusy(true)
    const ok = await currentService.resolve(store, choice)
    if (service.current !== currentService) return
    if (ok) { dirty.current = false; const next = currentService.snapshot(); setAnswers(next.document?.data.answers ?? {}); token.current = runningProfileEditToken(next) }
    setMessage(ok ? "선택한 응답을 반영했어요." : "계정 응답이 바뀌었거나 연결을 확인하지 못했어요. 다시 확인해 주세요.")
    setBusy(false)
  }
  const reviewLocal = () => {
    const latest = service.current?.snapshot()
    if (!review || !latest) return
    if (runningProfileEditToken(latest) !== runningProfileEditToken(review)) { setReview(latest); return }
    token.current = runningProfileEditToken(review); setReview(null); void finish(answers)
  }

  const entries = loadEntries()
  const metric = stage === "records" ? "level" : stage === "training" ? "mix" : "change"
  const result = resultStage && stage !== "preferences" ? buildOraclePersonalResult({ topicId: metric,
    entries, athleteRecords: recordSnapshot.records, today, planState: null, metric: "RPE" }) : null
  const unavailable = stage === "records" ? recordSnapshot.status !== "READY" : !journalHistory.journalReadComplete
    || Boolean(owner && accountJournalProjectionStatus() !== "READY")
  const canEdit = !busy && (!owner || ["READY", "EMPTY", "FAILED"].includes(store.status))

  return <div className="running-profile" data-reduced-motion={motion.reduced || undefined}>
    <header className="running-profile__header">
      <button type="button" onClick={onBack} aria-label="이전 단계로"><ArrowLeft size={18} aria-hidden="true" /></button>
      <span className="app-chrome-title">오라클 · 러닝 프로필</span>
      <button type="button" onClick={onClose} aria-label="프로필 닫기"><X size={18} aria-hidden="true" /></button>
    </header>
    <main className="running-profile__body">
      {owner && <div className="running-profile__storage" role="status">
        {store.status === "READY" ? dirty.current ? "응답 수정 중 · 아직 저장 전" : "계정에 보관된 응답" : store.status === "EMPTY" ? "응답을 마치면 계정에 보관해요" : store.status === "LOADING" ? "계정 응답을 확인하고 있어요" : store.status === "PENDING" ? "계정 전송 대기 · 응답은 이 기기에 임시 보관 중" : store.status === "CONFLICT" ? "다른 곳에서 바꾼 응답이 있어요" : store.status === "DELETED" ? "계정에서 삭제된 응답이에요" : "계정 응답을 확인하지 못했어요"}
        {["FAILED", "PENDING", "CONFLICT"].includes(store.status) && <button type="button" disabled={busy} onClick={() => void retry()}><RotateCcw size={16} aria-hidden="true" />다시 확인</button>}
      </div>}
      {message && <p role="status" className="running-profile__notice">{message}</p>}
      {review && <section className="running-profile__conflict" aria-label="변경된 계정 응답 확인">
        <AppHeading as="h2" variant="section">편집 중 계정 응답이 바뀌었어요</AppHeading>
        <p>계정: {describeRunningPreferences(review.document?.data.answers).title}</p>
        <button type="button" disabled={busy} onClick={reviewLocal}>이 화면 응답으로 저장</button>
        <button type="button" disabled={busy} onClick={() => { const latest = service.current?.snapshot(); if (!latest) return; setAnswers(latest.document?.data.answers ?? {}); token.current = runningProfileEditToken(latest); dirty.current = false; setReview(null); setMessage(null) }}>계정 응답 사용</button>
      </section>}
      {owner && store.status === "CONFLICT" && store.remoteRevision !== null && <section className="running-profile__conflict" aria-label="응답 충돌 확인">
        <AppHeading as="h2" variant="section">어느 응답을 남길까요?</AppHeading>
        <p>이 기기: {describeRunningPreferences(store.document?.data.answers).title}</p>
        <p>계정: {store.remote ? describeRunningPreferences(store.remote.data.answers).title : "응답 삭제됨"}</p>
        {store.remote && <button type="button" disabled={busy} onClick={() => void resolve("LOCAL")}>이 기기 응답 반영</button>}
        <button type="button" disabled={busy} onClick={() => void resolve("REMOTE")}>계정 상태 사용</button>
      </section>}

      {stage === "overview" && <section className="running-profile__stage">
        <p className="running-profile__source">좋아하는 방식과 실제 기록, 따로 살펴봐요</p>
        <AppHeading variant="screen" accent ref={heading} tabIndex={-1}>나는 어떻게 달리는 사람일까?</AppHeading>
        <div className="running-profile__map" aria-label="프로필의 네 가지 내용">
          {SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onStageChange(id)}><Icon size={22} aria-hidden="true" /><span>{label}</span><ChevronRight size={16} aria-hidden="true" /></button>)}
        </div>
        <button className="running-profile__primary" type="button" disabled={!canEdit} onClick={() => edit("motives")}>{description.answeredCount ? "내 응답 바꾸기" : "3문항으로 시작"}<ArrowRight size={18} aria-hidden="true" /></button>
        {description.answeredCount > 0 && <p>{description.title}</p>}
        <InfoDisclosure title="어떻게 해석하나요?"><p>선호는 직접 고른 응답으로, 기록과 변화는 확인된 일지로 설명해요. 검증된 성격 검사나 타고난 능력 판정은 아니에요.</p><p>응답 때문에 훈련 강도·양·횟수가 자동으로 바뀌지 않아요.</p></InfoDisclosure>
      </section>}

      {question && <section className="running-profile__stage" key={question.id} aria-busy={busy}>
        <p className="running-profile__source">{questionIndex < 3 ? `${questionIndex + 1} / 3` : `더 알아보기 ${questionIndex - 2} / 6`} · {question.label}</p>
        <AppHeading variant="screen" accent ref={heading} tabIndex={-1}>{question.title}</AppHeading>
        {question.multiple && <p className="running-profile__source">여러 개 골라도 좋아요</p>}
        <div className="running-profile__options" role="group" aria-label={question.label}>
          {question.options.map(option => <button key={option.id} type="button" disabled={busy} aria-pressed={answers[question.id]?.includes(option.id) ?? false} onClick={() => select(option.id)}>
            <span>{option.label}</span>{answers[question.id]?.includes(option.id) ? <Check size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
          </button>)}
        </div>
        {question.multiple && <button className="running-profile__primary" type="button" disabled={busy} onClick={() => advance(answers)}>{busy ? "저장 확인 중" : questionIndex === 8 ? "프로필 보기" : "다음"}<ArrowRight size={18} aria-hidden="true" /></button>}
        <button className="running-profile__text" type="button" disabled={busy} onClick={() => advance(answers)}>지금은 건너뛰기</button>
      </section>}

      {resultStage && <>
        <nav className="running-profile__tabs" aria-label="러닝 프로필 항목">
          {SECTIONS.map(section => <button key={section.id} type="button" aria-current={section.id === stage ? "page" : undefined} onClick={() => onStageChange(section.id)}>{section.label}</button>)}
        </nav>
        <section className="running-profile__stage" key={stage}>
          {stage === "preferences" ? <>
            <p className="running-profile__source">{description.source}</p>
            <AppHeading variant="screen" accent ref={heading} tabIndex={-1}>{description.title}</AppHeading>
            <dl className="running-profile__facts">{description.rows.filter(row => row.status !== "UNANSWERED").map(row => <div key={row.id}><dt>{row.label}</dt><dd>{row.text}</dd></div>)}</dl>
            <div className="running-profile__actions"><button type="button" disabled={!canEdit} onClick={() => edit("motives")}><Pencil size={16} aria-hidden="true" />응답 수정</button><button type="button" disabled={!canEdit} onClick={() => edit("routine")}>대회·종목·운동 취향 더하기<ChevronRight size={16} aria-hidden="true" /></button></div>
            {owner && dirty.current && <button className="running-profile__primary" type="button" disabled={busy || !["READY", "EMPTY"].includes(store.status)} onClick={() => void finish(answers)}>계정에 저장</button>}
            <InfoDisclosure title="이 결과의 기준"><p>{description.limit}</p><p>응답하지 않은 항목은 점수를 낮추지 않아요. 취향과 실제 훈련이 다르더라도 의지나 성격을 판단하지 않아요.</p></InfoDisclosure>
            <InfoDisclosure title="응답 관리"><button className="running-profile__text" type="button" disabled={!canEdit} onClick={() => setConfirmClear(true)}><Trash2 size={16} aria-hidden="true" />응답 지우기</button>
              {confirmClear && <div role="group" aria-label="응답 삭제 확인"><p>직접 고른 응답을 지울까요? 일지와 경기 기록은 그대로예요.</p><button type="button" disabled={busy} onClick={() => { dirty.current = true; token.current = runningProfileEditToken(store); setConfirmClear(false); void finish({}) }}>응답 지우기 확인</button><button type="button" onClick={() => setConfirmClear(false)}>취소</button></div>}
              {owner && <p>현재 응답을 지워도 이전 수정본은 계정의 기존 보관 정책에 따라 30일 남아요.</p>}
            </InfoDisclosure>
          </> : <>
            <p className="running-profile__source">{stage === "records" ? "입력된 경기 기록" : stage === "training" ? "출처를 확인한 훈련 일지" : "일지에 적은 체감 강도 · RPE"}</p>
            <AppHeading variant="screen" accent ref={heading} tabIndex={-1}>{stage === "records" ? "기록으로 확인하는 나" : stage === "training" ? "최근 어떤 훈련을 했을까?" : "훈련이 어떻게 느껴졌을까?"}</AppHeading>
            {unavailable ? <p role="status">{stage === "records" ? recordSnapshot.message : "일지를 모두 확인하지 못했어요. 없는 기록으로 판단하지 않아요."}</p>
              : stage === "records" && recordSnapshot.records.length > 0 && result?.status === "missing"
                ? <p>저장한 기록은 있어요. 실제 경기의 달성일이 있어야 비교할 수 있어요. 목표 기록은 비교에서 제외해요.</p>
              : result && <ProfileEvidence result={result} noResponse={stage === "changes" && result.metric !== "RPE"} showBars={stage !== "records"} />}
          </>}
        </section>
      </>}
      <InfoDisclosure title="과학적 근거와 해석 범위">
        <p>질문은 트레인오라클의 선호 수집용이에요. PRETIE-Q·MOMS 검사를 복제하거나 점수화하지 않아요.</p>
        <ul><li><a href="https://pubmed.ncbi.nlm.nih.gov/18274947/" target="_blank" rel="noreferrer">운동 강도 선호·내성 연구</a></li><li><a href="https://doi.org/10.1080/02701367.1993.10608790" target="_blank" rel="noreferrer">러닝 동기 연구</a></li><li><a href="https://pubmed.ncbi.nlm.nih.gov/38252665/" target="_blank" rel="noreferrer">스피드 예비력 측정 검토</a></li></ul>
        <p>CS·ASR, 재능, 근섬유 유형은 여기서 추정하지 않아요. 월별 RPE 차이는 훈련 조건이 같다는 뜻도, 훈련 효과의 증명도 아니에요.</p>
        <p>메모 원문은 읽지 않으며, 응답과 결과는 친구에게 자동 공유하지 않아요.</p>
      </InfoDisclosure>
      {!owner && <p className="running-profile__source running-profile__privacy">저장 없는 체험이에요. 닫거나 새로고침하면 응답이 사라져요.</p>}
    </main>
  </div>
}

function ProfileEvidence({ result, noResponse, showBars }: { readonly result: OraclePersonalResult; readonly noResponse: boolean; readonly showBars: boolean }) {
  if (noResponse) return <p>RPE를 남긴 일지가 있으면 월별로 비교할 수 있어요. 거리만으로 몸의 반응을 판단하지 않아요.</p>
  const max = Math.max(...result.rows.map(row => row.value), 0)
  return <>
    <AppHeading as="h2" variant="section">{result.headline}</AppHeading><p>{result.summary}</p>
    <dl className="running-profile__data">{result.rows.map((row, index) => <div key={`${index}-${row.label}`}><dt>{row.label}</dt><dd><strong>{row.valueLabel}</strong>{showBars && <span aria-hidden="true" className="running-profile__bar"><i style={{ width: `${max > 0 ? row.value / max * 100 : 0}%` }} /></span>}</dd></div>)}</dl>
    <p className="running-profile__source">{result.source}</p>
    {result.notice && <p role="note">{result.notice}</p>}
    <InfoDisclosure title="계산 기준과 알 수 없는 것"><p>{result.detail}</p></InfoDisclosure>
  </>
}
