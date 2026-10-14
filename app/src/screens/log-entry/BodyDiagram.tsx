import React from "react"
import { ArrowLeft, ChevronRight, Plus, X } from "lucide-react"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { hasPendingBrowserBackLayer } from "../../navigation/browserNavigation"
import { PainDot } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"
import { GLOSSARY } from "../../domain/glossary"
import { BODY_PARTS } from "../../components/body-parts"
import {
  OTHER_BODY_PART_COUNT_LIMIT,
  parseBodyPartMetadata,
  journalPainPartsForSafety,
} from "../../domain/body-part-metadata"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import type {
  BodyPartMetadataV1,
  OtherBodyPartId,
  OtherBodyPartObservation,
} from "../../domain/body-part-metadata"
import { BodyPartFocusView } from "./BodyPartFocusView"
import type { BodyPartFocusTarget, OtherBodyPartSelection, OtherBodyPartDraft } from "./BodyPartFocusView"
import { BODY_PART_GROUPS, bodyPartFocusLabel, bodyPartInputLabel, type BodyPartGroup } from "./body-part-presentation"
import "./BodyDiagram.css"

const EMPTY_SELECTED: Readonly<Record<string, number>> = Object.freeze({})
const EMPTY_RECENT_PARTS: readonly Pick<OtherBodyPartObservation, "id" | "labelSnapshot">[] = Object.freeze([])
const EMPTY_BODY_PART_METADATA: BodyPartMetadataV1 = { schemaVersion: 1, observations: [] }

interface BodyDiagramProps {
  readonly selected?: Readonly<Record<string, number>>
  readonly onChange?: (next: Record<string, number>) => void
  readonly metadata?: BodyPartMetadataV1
  readonly onMetadataChange?: (next: BodyPartMetadataV1 | undefined) => void
  readonly recentCustomParts?: readonly Pick<OtherBodyPartObservation, "id" | "labelSnapshot">[]
  readonly onRequestHistory?: () => void
  readonly initialPartId?: string
  readonly recentKnownPartIds?: readonly string[]
}

export function BodyDiagram({
  selected = EMPTY_SELECTED,
  onChange,
  metadata,
  onMetadataChange,
  recentCustomParts = EMPTY_RECENT_PARTS,
  onRequestHistory,
  initialPartId,
  recentKnownPartIds = [],
}: BodyDiagramProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [activeGroup, setActiveGroup] = React.useState<BodyPartGroup | null>(null)
  const [showSummary, setShowSummary] = React.useState(false)
  const [reviewHelpOpen, setReviewHelpOpen] = React.useState(false)
  const customDrafts = React.useRef(new Map<string, OtherBodyPartDraft>())
  const reviewHelpButton = React.useRef<HTMLButtonElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [activeTarget, setActiveTarget] = React.useState<BodyPartFocusTarget | null>(null)
  const [guideUnavailable, setGuideUnavailable] = React.useState(false)
  const [showMetadataWarning, setShowMetadataWarning] = React.useState(false)
  const dialogId = React.useId()
  const partButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const recentPartButtonRefs = React.useRef(new Map<OtherBodyPartId, HTMLButtonElement>())
  const addOtherButtonRef = React.useRef<HTMLButtonElement>(null)
  const activeReturnButton = React.useRef<HTMLElement | null>(null)
  const initialPartOpened = React.useRef(false)
  const supportedMetadata = React.useMemo(
    () => metadata === undefined ? EMPTY_BODY_PART_METADATA : parseBodyPartMetadata(metadata),
    [metadata],
  )
  const currentOtherParts = supportedMetadata?.observations ?? []
  const customEditingAvailable = onMetadataChange !== undefined && supportedMetadata !== null
  const hasSelection = BODY_PARTS.some(part => (selected[part.id] ?? 0) > 0) || currentOtherParts.length > 0
  const draftKey = activeTarget?.kind === "other" ? activeTarget.id ?? "new-other" : null
  const retainCustomDraft = React.useCallback((draft: OtherBodyPartDraft) => {
    if (draftKey !== null) customDrafts.current.set(draftKey, draft)
  }, [draftKey])

  const canSaveOtherPart = (id?: OtherBodyPartId) => {
    if (!customEditingAvailable || supportedMetadata === null) return false
    return supportedMetadata.observations.some(item => item.id === id)
      || supportedMetadata.observations.length < OTHER_BODY_PART_COUNT_LIMIT
  }

  const openKnownPart = (partId: string, trigger: HTMLElement | null) => {
    const part = BODY_PARTS.find(candidate => candidate.id === partId)
    if (!part) return
    setReviewHelpOpen(false)
    activeReturnButton.current = trigger
    setDialogOpen(true)
    setActiveGroup(null)
    setShowSummary(false)
    setActiveTarget({ kind: "known", part, currentLevel: selected[part.id] || 0 })
  }

  const openCurrentOtherPart = (observation: OtherBodyPartObservation, trigger: HTMLElement | null) => {
    setReviewHelpOpen(false)
    activeReturnButton.current = trigger
    setDialogOpen(true)
    setActiveGroup(null)
    setShowSummary(false)
    setActiveTarget({
      kind: "other",
      id: observation.id,
      labelSnapshot: observation.labelSnapshot,
      note: observation.note,
      currentLevel: observation.severity,
      recentCustomParts: [],
      canSave: id => canSaveOtherPart(id),
    })
  }

  React.useEffect(() => {
    if (initialPartOpened.current || !initialPartId) return
    const known = BODY_PARTS.find(part => part.id === initialPartId)
    const existing = currentOtherParts.find(item => item.id === initialPartId)
    const recent = recentCustomParts.find(item => item.id === initialPartId)
    if (!known && !existing && !recent) return
    initialPartOpened.current = true
    setDialogOpen(true)
    if (known) {
      activeReturnButton.current = partButtonRefs.current.get(known.id) ?? null
      setActiveTarget({ kind: "known", part: known, currentLevel: selected[known.id] || 0 })
    } else if (existing) {
      activeReturnButton.current = recentPartButtonRefs.current.get(existing.id) ?? null
      setActiveTarget({
        kind: "other",
        id: existing.id,
        labelSnapshot: existing.labelSnapshot,
        note: existing.note,
        currentLevel: existing.severity,
        recentCustomParts: [],
        canSave: id => canSaveOtherPart(id),
      })
    } else if (recent) {
      activeReturnButton.current = addOtherButtonRef.current
      setActiveTarget({
        kind: "other",
        id: recent.id,
        labelSnapshot: recent.labelSnapshot,
        currentLevel: 0,
        recentCustomParts,
        canSave: id => canSaveOtherPart(id),
      })
    }
  }, [initialPartId, currentOtherParts, recentCustomParts, selected, supportedMetadata])

  const closeFocus = () => { customDrafts.current.clear(); setReviewHelpOpen(false); setDialogOpen(false); setActiveTarget(null); setActiveGroup(null); setShowSummary(false) }
  const showResult = () => { if (draftKey !== null) customDrafts.current.delete(draftKey); setReviewHelpOpen(false); setActiveTarget(null); setActiveGroup(null); setShowSummary(true) }
  const showPicker = () => { setReviewHelpOpen(false); setActiveTarget(null); setActiveGroup(null); setShowSummary(false) }
  const goBack = () => {
    if (reviewHelpOpen) { setReviewHelpOpen(false); reviewHelpButton.current?.focus({ preventScroll: true }) }
    else showPicker()
  }

  const openGroup = (group: BodyPartGroup, trigger: HTMLElement | null) => {
    setReviewHelpOpen(false)
    if (!dialogOpen) activeReturnButton.current = trigger
    setDialogOpen(true)
    setShowSummary(false)
    setActiveTarget(null)
    if (group.ids.length === 1) {
      const part = BODY_PARTS.find(item => item.id === group.ids[0])!
      setActiveTarget({ kind: "known", part, currentLevel: selected[part.id] || 0 })
      setActiveGroup(null)
    } else setActiveGroup(group)
  }

  const chooseKnownLevel = (id: string, level: number) => {
    const output = { ...selected }
    if (level === 0) delete output[id]
    else output[id] = level
    onChange?.(output)
  }

  const chooseOtherLevel = (selection: OtherBodyPartSelection) => {
    if (supportedMetadata === null || onMetadataChange === undefined) {
      setShowMetadataWarning(true)
      return
    }
    if (selection.severity === 0) {
      if (!selection.id) return
      const observations = supportedMetadata.observations.filter(item => item.id !== selection.id)
      if (observations.length !== supportedMetadata.observations.length) {
        // Keep an explicit empty companion after removing the last custom part.
        onMetadataChange({ schemaVersion: 1, observations })
      }
      return
    }
    if (!selection.id) return

    const nextObservation: OtherBodyPartObservation = {
      id: selection.id,
      labelSnapshot: selection.labelSnapshot,
      severity: selection.severity as 1 | 2 | 3 | 4 | 5,
      ...(selection.note ? { note: selection.note } : {}),
    }
    const exists = supportedMetadata.observations.some(item => item.id === selection.id)
    if (!exists && supportedMetadata.observations.length >= OTHER_BODY_PART_COUNT_LIMIT) {
      setShowMetadataWarning(true)
      return
    }
    const observations = exists
      ? supportedMetadata.observations.map(item => item.id === selection.id ? nextObservation : item)
      : [...supportedMetadata.observations, nextObservation]
    const validated = parseBodyPartMetadata({ schemaVersion: 1, observations })
    if (!validated) {
      setShowMetadataWarning(true)
      return
    }
    onMetadataChange(validated)
  }

  const openNewOtherPart = (trigger: HTMLElement | null) => {
    if (!customEditingAvailable) return
    setReviewHelpOpen(false)
    activeReturnButton.current = trigger
    setDialogOpen(true)
    setActiveGroup(null)
    setShowSummary(false)
    setActiveTarget({
      kind: "other",
      labelSnapshot: "",
      currentLevel: 0,
      recentCustomParts,
      canSave: id => canSaveOtherPart(id),
    })
  }

  const selection = (inDialog: boolean) => <div className="body-pain-selector__summary" role="group" aria-label="선택한 부위">
    {BODY_PARTS.filter(part => (selected[part.id] ?? 0) > 0).map(part => <button key={part.id} type="button"
      className="app-choice-control body-pain-selector__part-button"
      aria-label={`${part.name}, 통증 ${selected[part.id]}/5`}
      onClick={event => openKnownPart(part.id, inDialog ? activeReturnButton.current : event.currentTarget)}>
      <PainDot level={selected[part.id] ?? 0} /><span>{bodyPartInputLabel(part)}</span><strong>{selected[part.id]}/5</strong><ChevronRight size={16} aria-hidden="true" />
    </button>)}
    {currentOtherParts.map(part => <button key={part.id} type="button"
      ref={node => { if (!inDialog) { if (node) recentPartButtonRefs.current.set(part.id, node); else recentPartButtonRefs.current.delete(part.id) } }}
      className="app-choice-control body-pain-selector__part-button"
      aria-label={`${part.labelSnapshot}, 통증 ${part.severity}/5`}
      onClick={event => openCurrentOtherPart(part, inDialog ? activeReturnButton.current : event.currentTarget)}>
      <PainDot level={part.severity} /><span>{part.labelSnapshot}</span><strong>{part.severity}/5</strong><ChevronRight size={16} aria-hidden="true" />
    </button>)}
  </div>

  const picker = (inDialog: boolean) => <div className="body-pain-selector__buttons" role="group" aria-label="몸 부위 선택">
    {BODY_PART_GROUPS.map(group => <button key={group.id} type="button"
      ref={node => { if (!inDialog) group.ids.forEach(id => { if (node) partButtonRefs.current.set(id, node); else partButtonRefs.current.delete(id) }) }}
      className="app-choice-control body-pain-selector__group-button"
      aria-haspopup="dialog" aria-expanded={!inDialog ? dialogOpen && (activeGroup?.id === group.id || (activeTarget?.kind === "known" && group.ids.some(id => id === activeTarget.part.id))) : undefined}
      onClick={event => openGroup(group, event.currentTarget)}>
      <span>{group.label}</span><ChevronRight size={16} aria-hidden="true" />
    </button>)}
    {customEditingAvailable && <button ref={!inDialog ? addOtherButtonRef : undefined} type="button"
      className="app-choice-control body-pain-selector__other-button" aria-haspopup="dialog"
      onClick={event => openNewOtherPart(inDialog ? activeReturnButton.current : event.currentTarget)}>
      <Plus size={16} aria-hidden="true" /><span>기타 부위 추가</span>
    </button>}
  </div>

  return (
    <div className="body-pain-selector" ref={rootRef} tabIndex={-1}>
      <div className="body-pain-selector__heading">
        {!guideUnavailable && <div className="body-pain-selector__visual" aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL || "/"}illustrations/body-check-emoji-v1.webp`}
            alt=""
            width={80}
            height={80}
            decoding="async"
            draggable={false}
            onError={() => setGuideUnavailable(true)}
          />
        </div>}
        <p className="body-pain-selector__instruction">{hasSelection ? "선택한 부위" : "불편한 곳을 골라요"}</p>
      </div>
      <div className="body-pain-selector__content">
        {hasSelection ? <>{selection(false)}<button type="button" className="app-choice-control body-pain-selector__other-button"
          onClick={event => { activeReturnButton.current = event.currentTarget; showPicker(); setDialogOpen(true) }}>
          <Plus size={16} aria-hidden="true" />다른 부위 추가
        </button></> : <>
          {recentKnownPartIds.length > 0 && <div className="body-pain-selector__recent" role="group" aria-label="최근 기록한 부위">
            <p>최근 부위</p>
            {Array.from(new Set(recentKnownPartIds)).slice(0, 3).map(id => {
              const part = BODY_PARTS.find(item => item.id === id)
              return part ? <button key={id} type="button" className="app-choice-control" onClick={event => openKnownPart(id, event.currentTarget)}>{bodyPartInputLabel(part)}</button> : null
            })}
          </div>}
          {picker(false)}
        </>}
        {onRequestHistory && <button type="button" className="body-pain-selector__history app-text-button" onClick={onRequestHistory}>
          몸 기록 보기<ChevronRight size={16} aria-hidden="true" />
        </button>}
        {showMetadataWarning && <p className="body-pain-selector__metadata-warning" role="status">
          기타 부위 정보를 적용하지 못했어요. 새로고침하거나 다시 확인해 주세요.
        </p>}
        {!customEditingAvailable && metadata !== undefined && onMetadataChange && <p className="body-pain-selector__metadata-warning" role="status">
          기타 부위 정보를 읽을 수 없어 수정할 수 없어요.
        </p>}
      </div>
      {dialogOpen && <BodySelectionDialog onClose={closeFocus} returnFocusTo={() => activeReturnButton.current?.isConnected ? activeReturnButton.current : rootRef.current}
        showComplete={showSummary}
        backLabel={reviewHelpOpen ? "도움말 닫기" : "부위 선택으로"}
        dialogId={dialogId} title={activeTarget ? activeTarget.kind === "known" ? bodyPartFocusLabel(activeTarget.part) : "기타 부위" : showSummary ? "선택한 부위" : activeGroup ? `${activeGroup.label} · 어느 쪽인가요?` : "불편한 곳을 골라요"}
        onBack={activeTarget || activeGroup || showSummary ? goBack : undefined}>
        {activeTarget ? <BodyPartFocusView embedded
          key={activeTarget.kind === "known" ? activeTarget.part.id : activeTarget.id ?? "new-other"}
          dialogId={`${dialogId}-fields`} target={activeTarget} onClose={showResult}
          onSelectKnown={chooseKnownLevel} onSelectOther={chooseOtherLevel}
          initialDraft={draftKey !== null ? customDrafts.current.get(draftKey) : undefined}
          onDraftChange={retainCustomDraft}
        /> : showSummary ? <>
          {hasSelection ? selection(true) : <p className="body-pain-selector__instruction">선택한 부위가 없어요.</p>}
          {painLevelsRequireReview(journalPainPartsForSafety({ painParts: selected, bodyPartMetadata: supportedMetadata ?? undefined })) && <PainReviewBanner
            inlineHelp={{ open: reviewHelpOpen, toggle: () => setReviewHelpOpen(value => !value), buttonRef: reviewHelpButton }} />}
          <button type="button" className="app-choice-control body-pain-selector__other-button" onClick={showPicker}><Plus size={16} aria-hidden="true" />다른 부위 추가</button>
        </> : activeGroup ? <div className="body-pain-selector__buttons" role="group" aria-label={`${activeGroup.label} 좌우 선택`}>
          {activeGroup.ids.map(id => {
            const part = BODY_PARTS.find(item => item.id === id)!
            return <button key={id} type="button" className="app-choice-control body-pain-selector__group-button"
              onClick={() => openKnownPart(id, activeReturnButton.current)}>{bodyPartInputLabel(part)}</button>
          })}
        </div> : picker(true)}
      </BodySelectionDialog>}
    </div>
  )
}

function BodySelectionDialog({ dialogId, title, onClose, returnFocusTo, onBack, backLabel, showComplete, children }: {
  dialogId: string; title: string; onClose: () => void; returnFocusTo: () => HTMLElement | null
  onBack?: (() => void) | undefined; backLabel: string; showComplete: boolean; children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const close = useReaderDialog(ref, onClose, returnFocusTo)
  const [ready, setReady] = React.useState(false)
  const [closeRequested, setCloseRequested] = React.useState(false)
  React.useEffect(() => { setReady(true) }, [])
  useTaskFlowBack({ enabled: ready && !closeRequested && Boolean(onBack), onBack: () => onBack?.() })
  const requestClose = () => setCloseRequested(true)
  React.useEffect(() => {
    if (!closeRequested) return
    let alive = true
    const finish = () => { if (alive && !hasPendingBrowserBackLayer()) close() }
    window.addEventListener("popstate", finish)
    queueMicrotask(finish)
    return () => { alive = false; window.removeEventListener("popstate", finish) }
  }, [closeRequested, close])
  React.useEffect(() => {
    // Run after the native dialog opens; retain the editor's meaningful target
    // instead of moving focus from a name or selected level to the title.
    const editorTarget = ref.current?.querySelector<HTMLElement>('.body-part-focus-fields input, .body-part-focus-fields button[aria-pressed="true"]')
    ;(editorTarget ?? heading.current)?.focus({ preventScroll: true })
  }, [title])
  return <dialog ref={ref} id={dialogId} className="body-part-focus-dialog" aria-modal="true" aria-labelledby={`${dialogId}-heading`}
    onCancel={event => { event.preventDefault(); if (onBack) onBack(); else requestClose() }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (onBack) onBack(); else requestClose() }
      if (event.key !== "Tab" || !ref.current) return
      const buttons = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, summary')).filter(element => !element.closest("details:not([open])") || element.tagName === "SUMMARY")
      const first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <header className="body-part-focus-dialog__header">
      {onBack && <button type="button" className="app-choice-control body-part-focus-dialog__close" aria-label={backLabel} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /></button>}
      <h2 id={`${dialogId}-heading`} ref={heading} tabIndex={-1} className="body-part-focus-dialog__title">{title}</h2>
      <button type="button" className="app-choice-control body-part-focus-dialog__close" aria-label="몸 상태 입력 닫기" onClick={requestClose}><X size={18} aria-hidden="true" /></button>
    </header>
    {children}
    {showComplete && <button type="button" className="app-choice-control body-part-focus-dialog__apply" onClick={requestClose}>입력 완료</button>}
  </dialog>
}

export function PainReviewBanner({ inlineHelp }: { inlineHelp?: { open: boolean; toggle: () => void; buttonRef: React.RefObject<HTMLButtonElement> } } = {}) {
  const helpId = React.useId()
  return (
    <div role="status" style={{
      marginTop: 10, padding: "10px 12px",
      border: "1.5px solid var(--warn)", background: "rgba(180,83,12,0.06)",
      display: "flex", alignItems: "flex-start", gap: 8,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: "var(--warn)",
        flexShrink: 0, marginTop: 4,
      }}></span>
      <div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", fontWeight: 600,
          letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--warn)",
        }}>통증 기록 확인{!inlineHelp && <TermHelp term="review" />}</div>
        <div style={{
          marginTop: 4, fontFamily: "var(--sans)", fontSize: 12.5,
          color: "var(--ink-2)", lineHeight: 1.5,
        }}>
          높은 통증은 사람이 꼭 확인해야 하는 기록이에요.
          지도자·보호자와 상의해 주세요.
          기록은 그대로 저장돼요.
        </div>
        {inlineHelp && <>
          <button ref={inlineHelp.buttonRef} type="button" className="app-text-button body-part-focus-dialog__review-help"
            aria-expanded={inlineHelp.open} aria-controls={helpId} onClick={inlineHelp.toggle}>왜 확인하나요?</button>
          {inlineHelp.open && <div id={helpId} className="body-part-focus-dialog__review-detail">
            <strong>{GLOSSARY.review.label} · {GLOSSARY.review.code}</strong>
            <p>{GLOSSARY.review.short}</p><p>{GLOSSARY.review.detail}</p><p>{GLOSSARY.review.notMeaning}</p>
          </div>}
        </>}
      </div>
    </div>
  )
}
