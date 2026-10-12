import React from "react"
import { PainDot } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"
import { BODY_PARTS } from "../../components/body-parts"
import {
  OTHER_BODY_PART_COUNT_LIMIT,
  parseBodyPartMetadata,
} from "../../domain/body-part-metadata"
import type {
  BodyPartMetadataV1,
  OtherBodyPartId,
  OtherBodyPartObservation,
} from "../../domain/body-part-metadata"
import { BodyPartFocusView } from "./BodyPartFocusView"
import type { BodyPartFocusTarget, OtherBodyPartSelection } from "./BodyPartFocusView"
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
}

export function BodyDiagram({
  selected = EMPTY_SELECTED,
  onChange,
  metadata,
  onMetadataChange,
  recentCustomParts = EMPTY_RECENT_PARTS,
  onRequestHistory,
  initialPartId,
}: BodyDiagramProps) {
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
  const otherDialogFromAddButton = activeTarget?.kind === "other" && activeReturnButton.current === addOtherButtonRef.current

  const canSaveOtherPart = (id?: OtherBodyPartId) => {
    if (!customEditingAvailable || supportedMetadata === null) return false
    return supportedMetadata.observations.some(item => item.id === id)
      || supportedMetadata.observations.length < OTHER_BODY_PART_COUNT_LIMIT
  }

  const openKnownPart = (partId: string, trigger: HTMLElement | null) => {
    const part = BODY_PARTS.find(candidate => candidate.id === partId)
    if (!part) return
    activeReturnButton.current = trigger
    setActiveTarget({ kind: "known", part, currentLevel: selected[part.id] || 0 })
  }

  const openCurrentOtherPart = (observation: OtherBodyPartObservation, trigger: HTMLElement | null) => {
    activeReturnButton.current = trigger
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

  const closeFocus = () => setActiveTarget(null)

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
    activeReturnButton.current = trigger
    setActiveTarget({
      kind: "other",
      labelSnapshot: "",
      currentLevel: 0,
      recentCustomParts,
      canSave: id => canSaveOtherPart(id),
    })
  }

  return (
    <div className="body-pain-selector">
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
        <p className="body-pain-selector__instruction">불편한 부위를 골라요</p>
      </div>
      <div className="body-pain-selector__content">
        <div className="body-pain-selector__buttons" role="group" aria-label="몸 부위 선택">
          {BODY_PARTS.map((part) => {
            const level = selected[part.id] || 0
            const isOpen = activeTarget?.kind === "known" && activeTarget.part.id === part.id
            return (
              <div className="body-pain-selector__part" key={part.id}>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) partButtonRefs.current.set(part.id, node)
                    else partButtonRefs.current.delete(part.id)
                  }}
                  aria-label={`${part.name}${level > 0 ? `, 통증 ${level}/5` : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? dialogId : undefined}
                  onClick={event => openKnownPart(part.id, event.currentTarget)}
                  className="body-pain-selector__part-button app-choice-control"
                >
                  <PainDot level={level} />
                  <span className="body-pain-selector__part-name">{part.name}</span>
                  {level > 0 && <span className="body-pain-selector__part-value">{level}/5</span>}
                </button>
              </div>
            )
          })}
          {currentOtherParts.map(observation => (
            <div className="body-pain-selector__part" key={observation.id}>
              <button
                type="button"
                ref={node => {
                  if (node) recentPartButtonRefs.current.set(observation.id, node)
                  else recentPartButtonRefs.current.delete(observation.id)
                }}
                className="body-pain-selector__part-button app-choice-control"
                aria-label={`${observation.labelSnapshot}, 통증 ${observation.severity}/5`}
                aria-expanded={activeTarget?.kind === "other" && activeTarget.id === observation.id}
                aria-controls={activeTarget?.kind === "other" && activeTarget.id === observation.id ? dialogId : undefined}
                onClick={event => openCurrentOtherPart(observation, event.currentTarget)}
              >
                <PainDot level={observation.severity} />
                <span className="body-pain-selector__part-name">{observation.labelSnapshot}</span>
                <span className="body-pain-selector__part-value">{observation.severity}/5</span>
              </button>
            </div>
          ))}
          {customEditingAvailable && <button
            ref={addOtherButtonRef}
            type="button"
            className="body-pain-selector__part-button body-pain-selector__other-button app-choice-control"
            aria-expanded={otherDialogFromAddButton}
            aria-controls={otherDialogFromAddButton ? dialogId : undefined}
            onClick={event => openNewOtherPart(event.currentTarget)}
          >
            <span aria-hidden="true">＋</span><span>기타 부위 추가</span>
          </button>}
        </div>
        {onRequestHistory && <button type="button" className="body-pain-selector__history app-text-button" onClick={onRequestHistory}>
          몸 부위 기록 이력 보기
        </button>}
        {showMetadataWarning && <p className="body-pain-selector__metadata-warning" role="status">
          기타 부위 정보를 적용하지 못했어요. 새로고침하거나 다시 확인해 주세요.
        </p>}
        {!customEditingAvailable && metadata !== undefined && onMetadataChange && <p className="body-pain-selector__metadata-warning" role="status">
          기타 부위 정보를 읽을 수 없어 수정할 수 없어요.
        </p>}
      </div>
      {activeTarget && <BodyPartFocusView
        key={activeTarget.kind === "known" ? activeTarget.part.id : activeTarget.id ?? "new-other"}
        dialogId={dialogId}
        target={activeTarget}
        onClose={closeFocus}
        onSelectKnown={chooseKnownLevel}
        onSelectOther={chooseOtherLevel}
        returnFocusTo={() => activeReturnButton.current}
      />}
    </div>
  )
}

export function PainReviewBanner() {
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
        }}>REVIEW · 통증 4 이상<TermHelp term="review" /></div>
        <div style={{
          marginTop: 4, fontFamily: "var(--sans)", fontSize: 12.5,
          color: "var(--ink-2)", lineHeight: 1.5,
        }}>
          높은 통증은 사람이 꼭 확인해야 하는 기록이에요.
          지도자·보호자와 상의해 주세요.
          기록은 그대로 저장돼요.
        </div>
      </div>
    </div>
  )
}
