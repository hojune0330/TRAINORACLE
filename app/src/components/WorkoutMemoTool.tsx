import React from "react"
import { Check, ChevronDown, ChevronUp, Copy, Download, Share2, StickyNote } from "lucide-react"
import { buildWorkoutMemo, type WorkoutMemoContext, type WorkoutMemoSession } from "../domain/workout-memo"
import { presentWorkoutMemo, WORKOUT_MEMO_GROUPS, WORKOUT_MEMO_WORDINGS, workoutMemoPresentationText, type WorkoutMemoGroup } from "../domain/workout-memo-presentation"
import type { WorkoutNotationStyle } from "../domain/workout-notation"
import { MEMO_PAPERS, downloadMemo, memoFileName, renderWorkoutMemoPng, type MemoPaper } from "../domain/workout-memo-export"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { WorkoutMemoSheet } from "./WorkoutMemoSheet"
import { CompanionStampPicker } from "./CompanionStampPicker"
import type { CompanionStamp } from "../domain/training-companions"
import { DEFAULT_WORKOUT_READING, useWorkoutReadingPreferences, type WorkoutReadingPreferences } from "../hooks/useWorkoutReadingPreferences"
import { buildWorkoutVisualGuide } from "../domain/workout-visual-guide"
import { VisualTrainingGuide } from "./VisualTrainingGuide"
import "../styles/workout-memo.css"

type WorkoutMemoProps = {
  readonly session: WorkoutMemoSession
  readonly mode?: "tool" | "reader" | "comparison"
  readonly allowExport?: boolean
  readonly primaryAction?: React.ReactNode
  readonly hideDate?: boolean
} & WorkoutMemoContext

function isMemoActive(element: HTMLElement | null): boolean {
  if (!element?.isConnected) return false
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.matches('[hidden], [inert], [aria-hidden="true"], dialog:not([open])')) return false
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false
  }
  return true
}

export function WorkoutMemoTool(props: WorkoutMemoProps) {
  if (props.mode === "reader") return <WorkoutReader {...props} />
  if (props.mode === "comparison") {
    const memo = buildWorkoutMemo(props.session, props, "PLAIN")
    return memo ? <WorkoutMemoSheet memo={presentWorkoutMemo(memo, "method")} paper="white" />
      : <p role="status">훈련 내용을 확인할 수 없어요. 계획을 다시 확인해 주세요.</p>
  }
  return <WorkoutMemoExporter {...props} />
}

function ReadingControls({ preferences, onChange, disabled = false }: {
  readonly preferences: WorkoutReadingPreferences
  readonly onChange: (value: WorkoutReadingPreferences) => void
  readonly disabled?: boolean
}) {
  return <div className="workout-memo-tool__reading-options">
    <label className="workout-memo-tool__wording">표현
      <select aria-label="메모 표현 방식" disabled={disabled} value={preferences.wording}
        onChange={event => onChange({ ...preferences, wording: event.target.value as WorkoutNotationStyle })}>
        {WORKOUT_MEMO_WORDINGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  </div>
}

function WorkoutReader({ session, date, state, reviewedExplanation, allowExport = true, primaryAction, hideDate }: WorkoutMemoProps) {
  const [preferences, update] = useWorkoutReadingPreferences()
  return <WorkoutMemoExporter session={session} date={date} state={state} reviewedExplanation={reviewedExplanation}
    allowExport={allowExport} primaryAction={primaryAction} hideDate={hideDate} reading={preferences} onReadingChange={update} initiallyOpen />
}

function WorkoutMemoExporter({ session, date, state = "PREVIEW", reviewedExplanation, allowExport = true, primaryAction, hideDate, initial = DEFAULT_WORKOUT_READING, initiallyOpen = false, reading, onReadingChange }: WorkoutMemoProps & {
  readonly initial?: WorkoutReadingPreferences
  readonly initiallyOpen?: boolean
  readonly reading?: WorkoutReadingPreferences
  readonly onReadingChange?: (value: WorkoutReadingPreferences) => void
}) {
  const [localWording, setLocalWording] = React.useState<WorkoutNotationStyle>(initial.wording)
  const [localGroup, setLocalGroup] = React.useState<WorkoutMemoGroup>(initial.group)
  const { wording, group } = reading ?? { wording: localWording, group: localGroup }
  const updateReading = (value: WorkoutReadingPreferences) => {
    if (onReadingChange) onReadingChange(value)
    else { setLocalWording(value.wording); setLocalGroup(value.group) }
  }
  const memo = React.useMemo(() => buildWorkoutMemo(session, { date, state, reviewedExplanation }, wording), [session, date, state, reviewedExplanation, wording])
  const visualGuide = React.useMemo(() => reading ? buildWorkoutVisualGuide(session, { date, state, reviewedExplanation }, { detail: group === "detail", wording }) : null,
    [session, date, state, reviewedExplanation, wording, group, Boolean(reading)])
  const [paper, setPaper] = React.useState<MemoPaper>("yellow")
  const [stamp, setStamp] = React.useState<CompanionStamp | null>(null)
  const [explanationOpen, setExplanationOpen] = React.useState(false)
  const view = group === "brief" ? "core" : explanationOpen ? "explained" : "method"
  const [open, setOpen] = React.useState(initiallyOpen)
  const [exporting, setExporting] = React.useState(false)
  const panelId = React.useId()
  const exportId = React.useId(), entry = React.useRef<HTMLButtonElement>(null), exportPanel = React.useRef<HTMLDivElement>(null)
  const root = React.useRef<HTMLElement>(null)
  const presentation = React.useMemo(() => memo ? presentWorkoutMemo(memo, view) : null, [memo, view])
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false), [fallback, setFallback] = React.useState(false)
  const [invalidated, setInvalidated] = React.useState(false)
  const lock = React.useRef(false), epoch = React.useRef(0)
  const png = React.useRef<{ key: string; blob: Blob } | null>(null)
  const text = presentation ? workoutMemoPresentationText(presentation) : ""
  const key = `${allowExport}:${view}:${wording}:${paper}:${stamp?.animal ?? "none"}:${stamp?.pose ?? "none"}:${text}`
  React.useLayoutEffect(() => {
    epoch.current++; lock.current = false; png.current = null
    setBusy(false); setMessage(null); setFailed(false); setFallback(false)
    return () => { epoch.current++; png.current = null }
  }, [key, session, date, state, reviewedExplanation])
  React.useEffect(() => onLocalJournalScopeChange(() => {
    epoch.current++; lock.current = false; png.current = null
    setOpen(false)
    setBusy(false); setMessage(null); setFallback(false); setInvalidated(true)
  }), [])
  React.useEffect(() => { setExporting(false); setExplanationOpen(false) }, [session, date, state, allowExport])
  React.useEffect(() => { if (group === "brief") setExplanationOpen(false) }, [group])
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      if (isMemoActive(root.current)) return
      epoch.current++; lock.current = false; png.current = null
      setExporting(false); setBusy(false); setMessage(null); setFailed(false); setFallback(false)
    })
    for (let element: HTMLElement | null = root.current; element; element = element.parentElement) {
      observer.observe(element, { attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "data-active-slot", "class", "style", "open"] })
    }
    return () => observer.disconnect()
  }, [])
  React.useEffect(() => {
    if (!exporting) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const activeRoot = root.current
      if (!activeRoot || !isMemoActive(activeRoot)) return
      const dialog = event.target instanceof Element ? event.target.closest("dialog") : null
      if (dialog && !dialog.contains(exportPanel.current)) return
      if (!dialog && !(event.target instanceof Node && activeRoot.contains(event.target))) return
      event.preventDefault(); event.stopImmediatePropagation(); closeExport()
    }
    document.addEventListener("keydown", escape, true)
    return () => document.removeEventListener("keydown", escape, true)
  }, [exporting])
  if (invalidated) return null
  if (!memo || !presentation) return <p role="status">훈련 내용을 확인할 수 없어요. 계획을 다시 확인해 주세요.</p>

  function closeMemo() {
    epoch.current++; lock.current = false; png.current = null
    setOpen(false); setBusy(false); setMessage(null); setFailed(false); setFallback(false)
  }

  function closeExport() {
    epoch.current++; lock.current = false; png.current = null
    setExporting(false); setBusy(false); setMessage(null); setFailed(false); setFallback(false)
    entry.current?.focus({ preventScroll: true })
  }

  async function act(action: "copy" | "save" | "share") {
    if (lock.current || !memo || !allowExport) return
    lock.current = true; setBusy(true); setMessage(null); setFailed(false)
    const revision = epoch.current, current = () => revision === epoch.current && isMemoActive(root.current)
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(text)
        if (current()) setMessage("복사했어요.")
      } else {
        const cached = png.current?.key === key ? png.current.blob : null
        const blob = cached ?? await renderWorkoutMemoPng(memo, paper, view, stamp)
        if (!current()) return
        png.current = { key, blob }
        const name = memoFileName(memo)
        const file = new File([blob], name, { type: "image/png" })
        if (action === "share" && navigator.canShare?.({ files: [file] }) && navigator.share) {
          // A newly generated image can consume iOS's transient activation. Retry from a fresh tap.
          if (!cached && navigator.userActivation?.isActive === false) { setMessage("이미지가 준비됐어요. 공유를 한 번 더 눌러 주세요."); return }
          await navigator.share({ files: [file], title: "훈련 메모" })
          if (current()) setMessage("공유창에 전달했어요.")
        } else {
          downloadMemo(blob, name)
          if (current()) setMessage(action === "share" ? "이 브라우저에서는 파일 공유 대신 이미지를 내려받아요." : "이미지 다운로드를 시작했어요.")
        }
      }
    } catch (error) {
      const canceled = typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
      if (!current() || canceled) return
      setFailed(true)
      if (action === "copy") { setFallback(true); setMessage("자동 복사가 막혔어요. 아래 글을 선택해 복사해 주세요.") }
      else setMessage("이미지를 내보내지 못했어요. 텍스트 복사를 이용하거나 다시 시도해 주세요.")
    } finally {
      if (current()) { lock.current = false; setBusy(false) }
    }
  }

  const showTools = allowExport && (!reading || exporting)
  return <section ref={root} className="workout-memo-tool" aria-label={reading ? "훈련 안내" : "훈련 메모"} data-mode={reading ? "reader" : "tool"} data-open={open || undefined}>
    {!reading && <div className="workout-memo-tool__heading"><StickyNote size={18} aria-hidden="true" /><h3>훈련 메모</h3>
      {open && <button type="button" aria-label="메모 접기" title="메모 접기" onClick={closeMemo}><ChevronUp size={18} aria-hidden="true" /></button>}
    </div>}
    <div className="workout-memo-tool__toolbar"><div className="workout-memo-tool__layouts app-choice-group" role="group" aria-label="메모 정보량">
      {WORKOUT_MEMO_GROUPS.map(item => <button className="app-choice-control" key={item.id} type="button" aria-pressed={open && group === item.id}
        aria-expanded={open && group === item.id} aria-controls={panelId}
        disabled={busy} onClick={() => { updateReading({ wording, group: item.id }); setOpen(true) }}>{item.label}</button>)}
    </div>
    {open && <ReadingControls preferences={{ wording, group }} disabled={busy} onChange={updateReading} />}
    </div>
    <div id={panelId} hidden={!open}>
    {open && <div className="workout-memo-tool__body">
      <WorkoutMemoSheet memo={presentation} paper={paper} stamp={stamp} hideDate={hideDate} onExplanationToggle={setExplanationOpen} />
      {visualGuide && <VisualTrainingGuide guide={visualGuide} disabled={busy || exporting} />}

      {primaryAction && <div className="plan-session-record-action">{primaryAction}</div>}
      {reading && allowExport && <button className="workout-memo-tool__export-entry" type="button" ref={entry} aria-expanded={exporting} aria-controls={exportId}
        onClick={() => exporting ? closeExport() : setExporting(true)}><Download size={18} aria-hidden="true" />{exporting ? "가져가기 닫기" : "메모 가져가기"}</button>}
      {showTools && <div ref={exportPanel} id={exportId} className="workout-memo-tool__export-panel">
      <details className="workout-memo-tool__customization">
        <summary>꾸미기<ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="workout-memo-tool__options">
          <CompanionStampPicker value={stamp} onChange={setStamp} disabled={busy} />
          <div className="workout-memo-tool__papers" role="group" aria-label="메모 종이 색">
            {MEMO_PAPERS.map(item => <button key={item.id} type="button" className="workout-memo-tool__swatch" data-paper={item.id}
              aria-label={item.label} title={item.label} aria-pressed={paper === item.id} disabled={busy} onClick={() => setPaper(item.id)}>
              {paper === item.id && <Check size={18} aria-hidden="true" />}
            </button>)}
          </div>
        </div>
      </details>
      {allowExport && <div className="workout-memo-tool__actions" role="group" aria-label="메모 가져가기" aria-busy={busy}>
        <button type="button" disabled={busy} onClick={() => void act("copy")}><Copy size={18} aria-hidden="true" />텍스트 복사</button>
        <button type="button" disabled={busy} onClick={() => void act("save")}><Download size={18} aria-hidden="true" />이미지 저장</button>
        <button type="button" disabled={busy} onClick={() => void act("share")}><Share2 size={18} aria-hidden="true" />공유</button>
      </div>}
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {fallback && <textarea readOnly aria-label="복사할 훈련 메모" value={text} onFocus={event => event.currentTarget.select()} />}
      {allowExport && <details className="workout-memo-tool__help"><summary>가져가는 내용<ChevronDown size={18} aria-hidden="true" /></summary>
        <p>지금 보이는 훈련을 담아요. 준비·정리 운동까지 담으려면 자세히를 골라 주세요. 일지에 쓴 글이나 계정·건강 정보는 넣지 않아요.</p>
      </details>}
      </div>}
    </div>}
    </div>
  </section>
}
