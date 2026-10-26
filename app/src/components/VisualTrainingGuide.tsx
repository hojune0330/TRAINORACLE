import React from "react"
import { ChevronLeft, ChevronRight, MessageCircle, Pause, Play, X } from "lucide-react"
import type { VisualTrainingGuideData, VisualTrainingStep } from "../domain/visual-training-guide"
import { ContextualIllustration } from "./ContextualIllustration"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { registerBrowserBackLayer } from "../navigation/browserNavigation"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import "../styles/visual-training-guide.css"

type Props = {
  readonly guide: VisualTrainingGuideData
  readonly selectedIndex?: number
  readonly onSelect?: (index: number) => void
  readonly disabled?: boolean
  readonly onOpenExplanation?: () => void
}

/** The same guide serves an existing prescription, a labelled example or sourced facts. */
export function VisualTrainingGuide(props: Props) {
  if (props.guide.steps.length === 0) return null
  return <Guide key={props.guide.id} {...props} />
}

function StepArtwork({ kind }: { readonly kind: VisualTrainingStep["kind"] }) {
  const files: Partial<Record<VisualTrainingStep["kind"], string>> = {
    walk: "training-walk-v1.webp", recovery: "training-recovery-v1.webp",
  }
  const file = files[kind]
  const [failed, setFailed] = React.useState(false)
  if (file) return failed ? null : <img src={`${import.meta.env.BASE_URL || "/"}illustrations/${file}`} alt="" aria-hidden="true"
    width={48} height={48} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
  return <ContextualIllustration image={kind === "record" ? "analysis-lens" : kind === "concept" ? "training-map"
    : kind === "preparation" || kind === "cooldown" ? "pace-stopwatch" : "running-shoe"} />
}

function Guide({ guide, selectedIndex, onSelect, disabled = false, onOpenExplanation }: Props) {
  const { reduced } = useCalendarMotion()
  const [localIndex, setLocalIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [expanded, setExpanded] = React.useState(true)
  const [explaining, setExplaining] = React.useState(false)
  const [invalidated, setInvalidated] = React.useState(false)
  const headingId = React.useId(), panelId = React.useId()
  const opener = React.useRef<HTMLButtonElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const activeIndex = Math.max(0, Math.min(guide.steps.length - 1, selectedIndex ?? localIndex))
  const current = guide.steps[activeIndex]!
  const select = React.useCallback((index: number) => {
    setLocalIndex(index)
    onSelect?.(index)
  }, [onSelect])
  React.useEffect(() => {
    if (!playing || reduced || disabled || !expanded || explaining) return
    const timer = window.setTimeout(() => {
      if (activeIndex >= guide.steps.length - 1) setPlaying(false)
      else select(activeIndex + 1)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, disabled, expanded, explaining, activeIndex, guide.steps.length, select])
  React.useEffect(() => { if (reduced || disabled || !expanded || explaining) setPlaying(false) }, [reduced, disabled, expanded, explaining])
  React.useEffect(() => { if (disabled) setExplaining(false) }, [disabled])
  React.useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener("visibilitychange", hide)
    const unsubscribe = onLocalJournalScopeChange(() => { setPlaying(false); setExplaining(false); setInvalidated(true) })
    return () => { document.removeEventListener("visibilitychange", hide); unsubscribe() }
  }, [])
  React.useLayoutEffect(() => {
    const button = list.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const row = button?.closest<HTMLElement>(".visual-guide__steps")
    if (!button || !row) return
    const b = button.getBoundingClientRect(), r = row.getBoundingClientRect()
    // Move only this horizontal diagram. Never scroll the surrounding reader.
    if (b.left < r.left) row.scrollLeft -= r.left - b.left
    else if (b.right > r.right) row.scrollLeft += b.right - r.right
  }, [activeIndex])
  const move = (index: number) => { setPlaying(false); if (index !== activeIndex) select(index) }
  const groups: { name: string; indices: number[] }[] = []
  guide.steps.forEach((step, index) => {
    const previous = groups[groups.length - 1]
    const name = step.group ?? ""
    if (previous?.name === name) previous.indices.push(index)
    else groups.push({ name, indices: [index] })
  })
  if (invalidated) return null
  return <section className="visual-guide" aria-labelledby={headingId} data-layout={guide.layout ?? "sequence"}
    data-training-visual-interactive="true" data-reduced-motion={reduced}>
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary><span id={headingId}>{guide.title}</span><span className="visual-guide__context">{guide.contextLabel}</span></summary>
      {guide.summary && <p className="visual-guide__summary">{guide.summary}</p>}
      <div ref={list} className="visual-guide__diagram" onPointerDown={() => setPlaying(false)} onWheel={() => setPlaying(false)}>
        {groups.map((group, groupIndex) => <div className="visual-guide__lane" key={groupIndex}>
          {group.name && <p className="visual-guide__group">{group.name}</p>}
          <ol className="visual-guide__steps" aria-label={group.name || (guide.layout === "facts" ? "확인된 항목" : "훈련 구간")}>
            {group.indices.map(index => {
              const step = guide.steps[index]!
              return <li key={step.id}><button type="button" aria-pressed={activeIndex === index} disabled={disabled}
                aria-label={[index + 1, step.label, step.amount, ...(step.details ?? [])].join(" ")}
                aria-controls={panelId} onClick={() => move(index)} data-kind={step.kind}>
                <span className="visual-guide__step-top"><span>{index + 1}</span><StepArtwork kind={step.kind} /></span>
                <strong>{step.label}</strong><span>{step.amount}</span>
                {step.details?.map((detail, i) => <span className="visual-guide__step-detail" key={i}>{detail}</span>)}
              </button></li>
            })}
          </ol>
        </div>)}
      </div>
      {guide.layout !== "facts" && <p className="visual-guide__caption">구간 순서를 보여줘요. 그림 길이는 시간·거리 비례가 아니에요.</p>}
      <div className="visual-guide__selection" id={panelId}>
        <div><p><strong>{current.label}</strong>{current.instruction && <> · {current.instruction}</>}</p></div>
        <button type="button" className="visual-guide__explain" ref={opener} disabled={disabled}
          aria-haspopup="dialog" aria-expanded={explaining} onClick={() => { setPlaying(false); setExplaining(true); onOpenExplanation?.() }}>
          <MessageCircle size={18} aria-hidden="true" />마리 설명</button>
      </div>
      {guide.steps.length > 1 && <div className="visual-guide__controls" role="group" aria-label={guide.layout === "facts" ? "항목 살펴보기" : "구간 살펴보기"}>
        <button type="button" aria-label="이전 구간" disabled={disabled || activeIndex === 0} onClick={() => move(activeIndex - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        {guide.layout !== "facts" && !reduced && <button type="button" disabled={disabled} aria-pressed={playing} onClick={() => {
          if (!playing && activeIndex === guide.steps.length - 1) select(0)
          setPlaying(value => !value)
        }}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? "멈추기" : "순서 재생"}</button>}
        <span aria-live={playing ? "off" : "polite"}>{activeIndex + 1} / {guide.steps.length}</span>
        <button type="button" aria-label="다음 구간" disabled={disabled || activeIndex === guide.steps.length - 1} onClick={() => move(activeIndex + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>}
      {guide.layout !== "facts" && <p className="visual-guide__caption">수행 타이머가 아닌 설명용 미리보기예요.</p>}
    </details>
    {explaining && <MariExplanation guide={guide} step={current} index={activeIndex} onClose={() => setExplaining(false)}
      onSelect={move} returnFocus={() => opener.current} />}
  </section>
}

function MariExplanation({ guide, step, index, onClose, onSelect, returnFocus }: {
  readonly guide: VisualTrainingGuideData; readonly step: VisualTrainingStep; readonly index: number
  readonly onClose: () => void; readonly onSelect: (index: number) => void; readonly returnFocus: () => HTMLElement | null
}) {
  const titleId = React.useId(), bodyId = React.useId()
  const dialog = React.useRef<HTMLDialogElement>(null)
  const closeButton = React.useRef<HTMLButtonElement>(null)
  const layer = React.useRef<ReturnType<typeof registerBrowserBackLayer> | null>(null)
  const latest = React.useRef({ onClose, returnFocus })
  latest.current = { onClose, returnFocus }
  React.useEffect(() => {
    const scope = localJournalScopeGeneration()
    const entry = registerBrowserBackLayer({ id: `mari-explanation-${titleId}`, canClose: () => true, onClose: () => latest.current.onClose() })
    layer.current = entry
    const element = dialog.current
    const overflow = document.body.style.overflow
    // An enclosing reader may already own the body lock. Do not restore its
    // snapshot after that reader unmounts together with this explanation.
    const ownsScrollLock = overflow !== "hidden"
    if (ownsScrollLock) document.body.style.overflow = "hidden"
    element?.showModal()
    closeButton.current?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element?.open) return
      event.preventDefault(); event.stopImmediatePropagation(); entry.close()
    }
    document.addEventListener("keydown", escape, true)
    return () => {
      document.removeEventListener("keydown", escape, true)
      entry.dispose(); layer.current = null
      if (element?.open) element.close()
      if (ownsScrollLock) document.body.style.overflow = overflow
      if (scope === localJournalScopeGeneration()) {
        const target = latest.current.returnFocus()
        if (target?.isConnected) target.focus({ preventScroll: true })
      }
    }
  }, [titleId])
  const close = () => layer.current?.close()
  return <dialog className="mari-explanation" ref={dialog} aria-labelledby={titleId} aria-describedby={bodyId}
    data-training-visual-interactive="true" onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="mari-explanation__surface">
      <header><div><span>{guide.contextLabel}</span><h3 id={titleId}>마리의 설명</h3></div>
        <button type="button" ref={closeButton} aria-label="마리 설명 닫기" onClick={close}><X size={20} aria-hidden="true" /></button></header>
      <div className="mari-explanation__intro">
        <ContextualIllustration image="mari-profile-explain" size="medium" />
        <div><p className="mari-explanation__position">{index + 1} / {guide.steps.length}{step.group && <> · {step.group}</>}</p>
          <h4>{step.label}</h4><p className="mari-explanation__amount">{step.amount}</p></div>
      </div>
      <div id={bodyId} className="mari-explanation__copy">
        <p>{step.explanation || step.instruction}</p>
        {step.explanation && step.instruction !== step.explanation && <p>{step.instruction}</p>}
        {step.details?.map((detail, i) => <p key={i}>{detail}</p>)}
      </div>
      {guide.steps.length > 1 && <nav className="mari-explanation__navigation" aria-label="설명 구간 선택">
        <button type="button" disabled={index === 0} onClick={() => onSelect(index - 1)}><ChevronLeft size={18} aria-hidden="true" />이전</button>
        <button type="button" disabled={index === guide.steps.length - 1} onClick={() => onSelect(index + 1)}>다음<ChevronRight size={18} aria-hidden="true" /></button>
      </nav>}
      {((guide.notes?.length ?? 0) > 0 || (guide.sources?.length ?? 0) > 0) && <details className="mari-explanation__evidence" key={step.id}>
        <summary>이유·근거 더 보기</summary>
        {guide.notes?.map((note, i) => <p key={i}>{note}</p>)}
        {guide.sources?.filter(source => /^https?:\/\//u.test(source.url)).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
      </details>}
    </div>
  </dialog>
}
