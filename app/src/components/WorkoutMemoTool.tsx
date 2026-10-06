import React from "react"
import { Check, ChevronUp, Copy, Download, Share2, StickyNote } from "lucide-react"
import { buildWorkoutMemo, type WorkoutMemoContext, type WorkoutMemoSession } from "../domain/workout-memo"
import { presentWorkoutMemo, WORKOUT_MEMO_GROUPS, WORKOUT_MEMO_VIEWS, WORKOUT_MEMO_WORDINGS, workoutMemoPresentationText, type WorkoutMemoGroup, type WorkoutMemoView } from "../domain/workout-memo-presentation"
import type { WorkoutNotationStyle } from "../domain/workout-notation"
import { MEMO_PAPERS, downloadMemo, memoFileName, renderWorkoutMemoPng, type MemoPaper } from "../domain/workout-memo-export"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { WorkoutMemoSheet } from "./WorkoutMemoSheet"
import "../styles/workout-memo.css"

export function WorkoutMemoTool({ session, date, state = "PREVIEW" }: { readonly session: WorkoutMemoSession } & WorkoutMemoContext) {
  const [wording, setWording] = React.useState<WorkoutNotationStyle>("PLAIN")
  const memo = React.useMemo(() => buildWorkoutMemo(session, { date, state }, wording), [session, date, state, wording])
  const [paper, setPaper] = React.useState<MemoPaper>("yellow")
  const [group, setGroup] = React.useState<WorkoutMemoGroup>("brief")
  const [views, setViews] = React.useState<Record<WorkoutMemoGroup, WorkoutMemoView>>({ brief: "standard", detail: "method" })
  const view = views[group]
  const [open, setOpen] = React.useState(false)
  const panelId = React.useId()
  const presentation = React.useMemo(() => memo ? presentWorkoutMemo(memo, view) : null, [memo, view])
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false), [fallback, setFallback] = React.useState(false)
  const [invalidated, setInvalidated] = React.useState(false)
  const lock = React.useRef(false), epoch = React.useRef(0)
  const png = React.useRef<{ key: string; blob: Blob } | null>(null)
  const text = presentation ? workoutMemoPresentationText(presentation) : ""
  const key = `${view}:${wording}:${paper}:${text}`
  React.useEffect(() => {
    epoch.current++; lock.current = false; png.current = null
    setBusy(false); setMessage(null); setFailed(false); setFallback(false); setInvalidated(false)
    return () => { epoch.current++; png.current = null }
  }, [key])
  React.useEffect(() => onLocalJournalScopeChange(() => {
    epoch.current++; lock.current = false; png.current = null
    setOpen(false)
    setBusy(false); setMessage(null); setFallback(false); setInvalidated(true)
  }), [])
  if (!memo || !presentation || invalidated) return null

  function closeMemo() {
    epoch.current++; lock.current = false; png.current = null
    setOpen(false); setBusy(false); setMessage(null); setFailed(false); setFallback(false)
  }

  async function act(action: "copy" | "save" | "share") {
    if (lock.current || !memo) return
    lock.current = true; setBusy(true); setMessage(null); setFailed(false)
    const revision = epoch.current, current = () => revision === epoch.current
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(text)
        if (current()) setMessage("복사했어요.")
      } else {
        const cached = png.current?.key === key ? png.current.blob : null
        const blob = cached ?? await renderWorkoutMemoPng(memo, paper, view)
        if (!current()) return
        png.current = { key, blob }
        const name = memoFileName(memo)
        const file = new File([blob], name, { type: "image/png" })
        if (action === "share" && navigator.canShare?.({ files: [file] }) && navigator.share) {
          // A newly generated image can consume iOS's transient activation. Retry from a fresh tap.
          if (!cached && navigator.userActivation?.isActive === false) { setMessage("이미지가 준비됐어요. 공유를 한 번 더 눌러 주세요."); return }
          await navigator.share({ files: [file], title: "훈련 메모" })
          if (current()) setMessage("공유했어요.")
        } else {
          downloadMemo(blob, name)
          if (current()) setMessage(action === "share" ? "이 브라우저에서는 파일 공유 대신 이미지를 내려받아요." : "이미지 다운로드를 시작했어요.")
        }
      }
    } catch (error) {
      if (!current() || (error instanceof DOMException && error.name === "AbortError")) return
      setFailed(true)
      if (action === "copy") { setFallback(true); setMessage("자동 복사가 막혔어요. 아래 글을 선택해 복사해 주세요.") }
      else setMessage("이미지를 내보내지 못했어요. 텍스트 복사를 이용하거나 다시 시도해 주세요.")
    } finally {
      if (current()) { lock.current = false; setBusy(false) }
    }
  }

  return <section className="workout-memo-tool" aria-label="훈련 메모" data-open={open || undefined}>
    <div className="workout-memo-tool__heading"><StickyNote size={18} aria-hidden="true" /><h3>훈련 메모</h3>
      {open && <button type="button" aria-label="메모 접기" title="메모 접기" onClick={closeMemo}><ChevronUp size={18} aria-hidden="true" /></button>}
    </div>
    <div className="workout-memo-tool__layouts" role="group" aria-label="메모 정보량">
      {WORKOUT_MEMO_GROUPS.map(item => <button key={item.id} type="button" aria-pressed={open && group === item.id}
        aria-expanded={open && group === item.id} aria-controls={panelId}
        disabled={busy} onClick={() => { setGroup(item.id); setOpen(true) }}>{item.label}</button>)}
    </div>
    <div id={panelId} hidden={!open}>
    {open && <div className="workout-memo-tool__body">
      <div className="workout-memo-tool__options">
        <div className="workout-memo-tool__layouts workout-memo-tool__subchoices" role="group" aria-label="메모 세부 보기">
          {WORKOUT_MEMO_VIEWS.filter(item => item.group === group).map(item => <button key={item.id} type="button"
            aria-pressed={view === item.id} disabled={busy} onClick={() => setViews(previous => ({ ...previous, [group]: item.id }))}>{item.label}</button>)}
        </div>
        <div className="workout-memo-tool__layouts workout-memo-tool__subchoices" role="group" aria-label="메모 표현 방식">
          {WORKOUT_MEMO_WORDINGS.map(item => <button key={item.id} type="button" aria-pressed={wording === item.id}
            disabled={busy} onClick={() => setWording(item.id)}>{item.label}</button>)}
        </div>
      </div>
      <div className="workout-memo-tool__papers" role="group" aria-label="메모 종이 색">
        {MEMO_PAPERS.map(item => <button key={item.id} type="button" className="workout-memo-tool__swatch" data-paper={item.id}
          aria-label={item.label} title={item.label} aria-pressed={paper === item.id} disabled={busy} onClick={() => setPaper(item.id)}>
          {paper === item.id && <Check size={18} aria-hidden="true" />}
        </button>)}
      </div>
      <WorkoutMemoSheet memo={presentation} paper={paper} />
      <div className="workout-memo-tool__actions" aria-label="메모 가져가기" aria-busy={busy}>
        <button type="button" disabled={busy} onClick={() => void act("copy")}><Copy size={18} aria-hidden="true" />복사</button>
        <button type="button" disabled={busy} onClick={() => void act("save")}><Download size={18} aria-hidden="true" />저장</button>
        <button type="button" disabled={busy} onClick={() => void act("share")}><Share2 size={18} aria-hidden="true" />공유</button>
      </div>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {fallback && <textarea readOnly aria-label="복사할 훈련 메모" value={text} onFocus={event => event.currentTarget.select()} />}
      <details className="workout-memo-tool__help"><summary>메모에 무엇이 담기나요?</summary>
        <p>지금 보는 훈련만 담아요. 일지에 쓴 글이나 계정·건강 정보는 넣지 않아요. 이미지 저장은 일지 저장과 달라요.</p>
        <p>핵심만은 겹치는 정보를 묶고, 기본은 항목별로, 방법은 수행 순서로 보여요. 설명까지를 고르면 훈련 목적과 기존 근거도 함께 볼 수 있어요. 쉬운 말과 훈련 표기는 숫자가 같아요.</p>
      </details>
    </div>}
    </div>
  </section>
}
