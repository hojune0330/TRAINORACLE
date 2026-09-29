import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight } from "lucide-react"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { useLocalToday } from "../../hooks/useLocalToday"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { prepareCurrentExecutionReplan, applyExecutionReplan } from "../../domain/execution-replan-store"
import { replanFingerprint, type ReplanPreparation, type ExecutionReplanProposal } from "../../domain/execution-replan"
import { isoShift, isoToDate } from "../../domain/dates"
import { sessionLabel, prescriptionLabel } from "../plan-beta/labels"
import type { VersionedStoredPlanSession } from "../../domain/plan-session-schema"
import "../../styles/execution-review.css"

function Workout({ session }: { session: VersionedStoredPlanSession }) {
  const p = session.prescription
  const range = (min: number, max: number) => min === max ? `${min}` : `${min}~${max}`
  const summary = p.kind === "RPE_TIME_RANGE"
    ? `${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}분 · RPE ${range(p.rpe.minimum, p.rpe.maximum)}`
    : p.kind === "REST" ? "운동 없음" : prescriptionLabel(session)
  return <><strong>{sessionLabel(session)}</strong><span>{summary}</span></>
}

export function ExecutionReplan({ entryId, onClose, onOpenPlan, onOpenJournal, returnFocusTo }: {
  entryId: string; onClose: () => void; onOpenPlan?: () => void; onOpenJournal?: () => void; returnFocusTo?: () => HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null)
  const today = useLocalToday(), id = useId()
  const [confirmed, setConfirmed] = useState(false), [fixedFree, setFixedFree] = useState(false)
  const [preparation, setPreparation] = useState<ReplanPreparation | null>(null)
  const [selected, setSelected] = useState<ExecutionReplanProposal | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  const [applied, setApplied] = useState(false), [uncertain, setUncertain] = useState(false)
  const [needsSafetyReview, setNeedsSafetyReview] = useState(false)
  const afterClose = useRef<(() => void) | undefined>(undefined), alive = useRef(true)
  const close = useReaderDialog(dialog, () => { onClose(); afterClose.current?.() }, returnFocusTo)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => onLocalJournalScopeChange(() => { alive.current = false; onClose() }), [onClose])
  useEffect(() => {
    if (!confirmed) return
    let cancelled = false
    setSelected(null); setPreparation(null); setMessage("")
    void prepareCurrentExecutionReplan(entryId, today, fixedFree).then(result => { if (!cancelled) setPreparation(result) })
      .catch(() => { if (!cancelled) setMessage("계획을 불러오지 못했어요. 다시 열어 주세요.") })
    return () => { cancelled = true }
  }, [confirmed, fixedFree, entryId, today])
  useEffect(() => { heading.current?.focus({ preventScroll: true }); dialog.current?.querySelector(".plan-day-reader__body")?.scrollTo({ top: 0 }) }, [selected, confirmed, applied])
  const apply = async () => {
    if (!selected || busy || uncertain) return
    setBusy(true); setMessage("")
    const result = await applyExecutionReplan(selected, today, confirmed)
    if (!alive.current) return
    setBusy(false)
    if (result.kind === "applied") setApplied(true)
    else { setMessage(result.message); setUncertain(result.kind === "uncertain") }
  }
  const title = applied ? "남은 일정을 바꿨어요" : !confirmed ? "지금 몸 상태는 어떤가요?" : selected ? "이렇게 바꿀까요?" : "무엇을 바꿀까요?"
  return createPortal(<dialog ref={dialog} className="plan-day-reader execution-review-reader" aria-labelledby={`${id}-title`}
    onCancel={e => { e.preventDefault(); if (!busy) close() }}>
    <header className="plan-day-reader__header"><button type="button" disabled={busy} aria-label={selected && !applied ? "변경안 선택으로" : "훈련 코칭으로 돌아가기"}
      onClick={() => selected && !applied && !uncertain ? setSelected(null) : close()}><ArrowLeft size={20} /></button>
      <div><span>남은 일정 조정</span><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{title}</h2></div></header>
    <div className="plan-day-reader__body"><div className="plan-day-reader__content execution-review execution-replan">
      {message && <p role="alert">{message}</p>}
      {applied ? <><Check size={28} aria-hidden="true" /><p>이전 계획과 일지는 그대로 보관했어요.</p></>
        : needsSafetyReview ? <p>일정은 바꾸지 않았어요. 일지에서 통증·몸 상태를 확인해 주세요.</p>
        : !confirmed ? <div className="execution-replan__choices">
          <button type="button" onClick={() => setConfirmed(true)}><span>알고 있는 통증·이상이 없어요</span><ChevronRight size={18} /></button>
          <button type="button" onClick={() => setNeedsSafetyReview(true)}><span>통증·이상이 있거나 잘 모르겠어요</span><ChevronRight size={18} /></button>
        </div> : selected ? <>
          <p>{selected.reason}</p>
          <div className="execution-replan__comparison">{selected.after.activePlan.sessions.flatMap((session,index) => {
            const before = selected.before.activePlan.sessions[index]!
            if (replanFingerprint(before) === replanFingerprint(session)) return []
            const date = isoShift(selected.after.intake.startDate!, session.day-1)
            return [<section key={`${session.day}:${session.slot}`}><h3><CalendarDays size={18} aria-hidden="true" />{isoToDate(date).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} · {session.slot === "AM" ? "오전" : "오후"}</h3>
              <div className="execution-replan__before-after"><div><small>변경 전</small><Workout session={before} /></div><ArrowRight size={18} aria-hidden="true" /><div><small>변경 후</small><Workout session={session} /></div></div></section>]
          })}</div>
          <p className="execution-review__muted">표시한 날짜만 바꿔요. 오늘과 이미 기록한 훈련은 그대로예요.</p>
          <details><summary>남은 일정 전체</summary>{selected.after.activePlan.sessions.filter(s => isoShift(selected.after.intake.startDate!, s.day-1) > today).map(s => <p key={`${s.day}:${s.slot}`}><strong>{isoShift(selected.after.intake.startDate!, s.day-1)} · {s.slot === "AM" ? "오전" : "오후"}</strong><br />{prescriptionLabel(s)}</p>)}</details>
          <details><summary>이 변경의 한계</summary><p>실제 기록을 확인한 뒤 본인이 고른 변경이에요. 수행량이나 회복 정도를 자동 진단하지 않아요. 못 한 훈련을 더하지 않으며, 다음 주기는 이번 변경만으로 자동 생성하지 않아요.</p></details>
        </> : <>
          <p className="execution-review__muted">남긴 기록을 바탕으로 내일 이후만 조정해요. 그대로 진행해도 괜찮아요.</p>
          {!preparation && !message && <p role="status">기록과 남은 일정을 확인하고 있어요.</p>}
          {preparation?.kind === "blocked" && <p role="status">{preparation.message}</p>}
          {preparation?.kind === "ready" && <>
            <div className="execution-replan__choices"><button type="button" onClick={close}><span>원래 일정 유지</span><ChevronRight size={18} /></button>
              {preparation.proposals.map(p => <button type="button" key={p.id} onClick={() => setSelected(p)}><span>{p.title}</span><ChevronRight size={18} /></button>)}</div>
            <label className="execution-replan__check"><input type="checkbox" checked={fixedFree} onChange={e => setFixedFree(e.target.checked)} />옮길 날짜에 경기나 고정 일정이 없어요</label>
            {preparation.unavailable.length > 0 && <details><summary>다른 변경을 제안하지 않은 이유</summary>{preparation.unavailable.map(item => <p key={item.action}>{item.reason}</p>)}</details>}
          </>}
        </>}
    </div></div>
    {(selected || applied || uncertain || needsSafetyReview) && <footer className="execution-review__actions">
      {needsSafetyReview ? <button type="button" data-primary="true" onClick={() => { afterClose.current = onOpenJournal ?? onOpenPlan; close() }}>{onOpenJournal ? "일지에서 몸 상태 확인" : "현재 일정 확인"}</button>
        : applied || uncertain ? <button type="button" data-primary="true" onClick={() => { afterClose.current = onOpenPlan; close() }}>현재 일정 확인</button>
        : <button type="button" data-primary="true" disabled={busy} onClick={() => void apply()}>{busy ? "저장 확인 중…" : "이 일정으로 바꾸기"}</button>}
    </footer>}
  </dialog>, document.body)
}
