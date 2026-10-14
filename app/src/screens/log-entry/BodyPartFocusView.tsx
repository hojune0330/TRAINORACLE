import React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { BODY_PARTS } from "../../components/body-parts"
import {
  createOtherBodyPartId,
  parseBodyPartMetadata,
  OTHER_BODY_PART_LABEL_LIMIT,
  OTHER_BODY_PART_NOTE_LIMIT,
} from "../../domain/body-part-metadata"
import type { OtherBodyPartId, OtherBodyPartObservation } from "../../domain/body-part-metadata"
import "./BodyPartFocusView.css"
import { bodyPartFocusLabel } from "./body-part-presentation"

type KnownBodyPart = typeof BODY_PARTS[number]
type RecentCustomPart = Pick<OtherBodyPartObservation, "id" | "labelSnapshot">
// Only retained while the enclosing body-input dialog is open; never persisted.
export type OtherBodyPartDraft = {
  name: string
  note: string
  id: OtherBodyPartId | undefined
  level: number
  recentSelection: { id: OtherBodyPartId; label: string } | null
}
type FocusAnchor = { readonly side: "front" | "back"; readonly x: number; readonly y: number }

/** Display-only crop anchors from the generated v2 front/back bitmaps.
 * They do not affect stored IDs, severity, safety interpretation, or analysis. */
export const BODY_PART_FOCUS_ANCHORS: Readonly<Record<KnownBodyPart["id"], FocusAnchor>> = {
  rKnee: { side: "front", x: 0.444, y: 0.716 },
  lKnee: { side: "front", x: 0.556, y: 0.716 },
  rFoot: { side: "front", x: 0.435, y: 0.896 },
  lFoot: { side: "front", x: 0.565, y: 0.896 },
  rShin: { side: "front", x: 0.500, y: 0.800 },
  rHam: { side: "back", x: 0.556, y: 0.655 },
  lHam: { side: "back", x: 0.444, y: 0.655 },
  rCalf: { side: "back", x: 0.556, y: 0.800 },
  lCalf: { side: "back", x: 0.444, y: 0.800 },
  lBack: { side: "back", x: 0.500, y: 0.490 },
}

export type OtherBodyPartSelection = {
  readonly id?: OtherBodyPartId
  readonly labelSnapshot: string
  readonly severity: 0 | 1 | 2 | 3 | 4 | 5
  readonly note?: string
}

export type BodyPartFocusTarget =
  | { readonly kind: "known"; readonly part: KnownBodyPart; readonly currentLevel: number }
  | {
      readonly kind: "other"
      readonly id?: OtherBodyPartId
      readonly labelSnapshot: string
      readonly note?: string
      readonly currentLevel: number
      readonly recentCustomParts: readonly RecentCustomPart[]
      readonly canSave: (id?: OtherBodyPartId) => boolean
    }

type BodyPartFocusViewProps = {
  readonly dialogId: string
  readonly target: BodyPartFocusTarget
  readonly onClose: () => void
  readonly onSelectKnown: (id: KnownBodyPart["id"], level: number) => void
  readonly onSelectOther: (selection: OtherBodyPartSelection) => void
  readonly returnFocusTo?: () => HTMLElement | null
  readonly embedded?: boolean
  readonly initialDraft?: OtherBodyPartDraft | undefined
  readonly onDraftChange?: ((draft: OtherBodyPartDraft) => void) | undefined
}

const FOCUS_ZOOM = 2.2
const OTHER_NAME_FORBIDDEN = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u

function focusablesWithin(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'summary, button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter(candidate => {
    if (candidate.hidden || candidate.closest('[aria-hidden="true"]')) return false
    const closedDetails = candidate.closest<HTMLDetailsElement>("details:not([open])")
    return closedDetails === null || (candidate.matches("summary") && closedDetails.firstElementChild === candidate)
  })
}

function otherNameError(label: string): string | null {
  if (label.length === 0 || label.trim().length === 0) return "부위 이름을 입력해 주세요."
  if (label.length > OTHER_BODY_PART_LABEL_LIMIT) return `부위 이름은 ${OTHER_BODY_PART_LABEL_LIMIT}자까지 입력할 수 있어요.`
  if (label.trim() !== label) return "이름 앞뒤의 공백을 확인해 주세요."
  if (OTHER_NAME_FORBIDDEN.test(label)) return "이름에 사용할 수 없는 문자가 있어요."
  return null
}

export function BodyPartFocusView({
  dialogId,
  target,
  onClose,
  onSelectKnown,
  onSelectOther,
  returnFocusTo,
  embedded = false,
  initialDraft,
  onDraftChange,
}: BodyPartFocusViewProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const nameInputRef = React.useRef<HTMLInputElement>(null)
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const levelRefs = React.useRef(new Map<number, HTMLButtonElement>())
  const closeDialog = useReaderDialog(dialogRef, onClose, returnFocusTo, !embedded)
  const close = embedded ? onClose : closeDialog
  const [imageUnavailable, setImageUnavailable] = React.useState(false)
  const [customName, setCustomName] = React.useState(initialDraft?.name ?? (target.kind === "other" ? target.labelSnapshot : ""))
  const [customNote, setCustomNote] = React.useState(initialDraft?.note ?? (target.kind === "other" ? target.note ?? "" : ""))
  const [customId, setCustomId] = React.useState<OtherBodyPartId | undefined>(initialDraft ? initialDraft.id : target.kind === "other" ? target.id : undefined)
  const [currentLevel, setCurrentLevel] = React.useState(initialDraft?.level ?? target.currentLevel)
  const [memoOpen, setMemoOpen] = React.useState(Boolean(initialDraft?.note || (target.kind === "other" && target.note)))
  const [validationMessage, setValidationMessage] = React.useState("")
  const [validationField, setValidationField] = React.useState<"name" | "note" | "general" | "">("")
  const [recentSelection, setRecentSelection] = React.useState<{ id: OtherBodyPartId; label: string } | null>(() =>
    initialDraft ? initialDraft.recentSelection : target.kind === "other" && target.id
      ? target.recentCustomParts.find(candidate => candidate.id === target.id)
        ? { id: target.id, label: target.labelSnapshot }
        : null
      : null,
  )

  React.useEffect(() => {
    if (target.kind === "other") onDraftChange?.({ name: customName, note: customNote, id: customId, level: currentLevel, recentSelection })
  }, [target.kind, customName, customNote, customId, currentLevel, recentSelection, onDraftChange])

  const known = target.kind === "known" ? target.part : null
  const anchor = known ? BODY_PART_FOCUS_ANCHORS[known.id] : null
  const sideLabel = anchor?.side === "back" ? "뒷면" : anchor?.side === "front" ? "앞면" : null
  const baseUrl = import.meta.env.BASE_URL || "/"
  const focusImageSrc = `${baseUrl}illustrations/body-check-focus-${anchor?.side ?? "front"}-v2.webp`
  const matchingRecentPart = target.kind === "other"
    ? target.recentCustomParts.find(candidate => candidate.labelSnapshot === customName.trim())
    : undefined
  const title = target.kind === "known"
    ? bodyPartFocusLabel(target.part)
    : "기타 부위"
  const focusTitleId = `${dialogId}-title`
  const scaleDescriptionId = `${dialogId}-scale`
  const nameInputId = `${dialogId}-other-name`
  const noteInputId = `${dialogId}-other-note`
  const invalidCustomMetadata = target.kind === "other" && otherNameError(customName) !== null

  React.useEffect(() => {
    const initialFocus = target.kind === "other"
      ? nameInputRef.current
      : currentLevel > 0
        ? levelRefs.current.get(currentLevel)
        : titleRef.current
    initialFocus?.focus({ preventScroll: true })
  }, [])

  const handleSelectLevel = (level: number) => {
    if (target.kind === "known") {
      onSelectKnown(target.part.id, level)
      close()
      return
    }

    if (level === 0) {
      if (customId) onSelectOther({ id: customId, labelSnapshot: customName, severity: 0 })
      close()
      return
    }

    const nameError = otherNameError(customName)
    if (nameError) {
      setValidationField("name")
      setValidationMessage(nameError)
      return
    }
    if (customNote.length > OTHER_BODY_PART_NOTE_LIMIT || customNote.includes("\u0000")) {
      setValidationField("note")
      setValidationMessage(`추가 메모는 ${OTHER_BODY_PART_NOTE_LIMIT}자까지 입력할 수 있어요.`)
      return
    }

    let id = customId
    try {
      id ??= createOtherBodyPartId()
    } catch {
      setValidationField("general")
      setValidationMessage("부위 정보를 적용하지 못했어요. 다시 시도해 주세요.")
      return
    }
    const observation: OtherBodyPartObservation = {
      id,
      labelSnapshot: customName,
      severity: level as 1 | 2 | 3 | 4 | 5,
      ...(customNote.length > 0 ? { note: customNote } : {}),
    }
    if (parseBodyPartMetadata({ schemaVersion: 1, observations: [observation] }) === null) {
      setValidationField("general")
      setValidationMessage("부위 이름이나 추가 메모를 확인해 주세요.")
      return
    }
    if (!target.canSave(id)) {
      setValidationField("general")
      setValidationMessage("기타 부위 기록을 더 추가할 수 없어요.")
      return
    }

    onSelectOther({ id, labelSnapshot: customName, severity: level as 1 | 2 | 3 | 4 | 5,
      ...(customNote.length > 0 ? { note: customNote } : {}) })
    close()
  }

  const Frame = embedded ? "section" : "dialog"
  return (
    <Frame
      ref={embedded ? undefined : dialogRef}
      id={dialogId}
      className={embedded ? "body-part-focus-fields" : "body-part-focus-dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby={embedded ? undefined : focusTitleId}
      aria-label={embedded ? title : undefined}
      data-testid="body-part-focus-dialog"
      onCancel={event => { event.preventDefault(); close() }}
      onKeyDown={event => {
        if (embedded) return
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          close()
          return
        }
        if (event.key !== "Tab") return
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = focusablesWithin(dialog)
        if (focusables.length === 0) {
          event.preventDefault()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return
        if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      {!embedded && <div className="body-part-focus-dialog__header">
        <h2 id={focusTitleId} ref={titleRef} tabIndex={-1} className="body-part-focus-dialog__title">{title}</h2>
        {!embedded && <button type="button" className="app-choice-control body-part-focus-dialog__close"
          aria-label={`${title} 닫기`} onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>}
      </div>}

      {anchor && !imageUnavailable && <figure className="body-part-focus-dialog__figure body-part-focus-dialog__figure--crop"
        data-focus-side={sideLabel ?? undefined}>
        <img
          src={focusImageSrc}
          alt={`${known ? bodyPartFocusLabel(known) : ""} 위치 · ${sideLabel}`}
          decoding="async"
          draggable={false}
          className="body-part-focus-dialog__image body-part-focus-dialog__image--crop"
          style={{
            left: `calc(50% - ${anchor.x * FOCUS_ZOOM * 100}%)`,
            top: `calc(50% - ${anchor.y * FOCUS_ZOOM * 100}%)`,
            width: `${FOCUS_ZOOM * 100}%`,
            height: `${FOCUS_ZOOM * 100}%`,
          }}
          onError={() => setImageUnavailable(true)}
        />
        {known?.id === "rShin" ? <>
          <span className="body-part-focus-dialog__marker" style={{ left: "37.7%" }} aria-hidden="true" />
          <span className="body-part-focus-dialog__marker" style={{ left: "62.3%" }} aria-hidden="true" />
        </> : <span className="body-part-focus-dialog__marker" aria-hidden="true" />}
        <figcaption>{sideLabel ?? "위치 미표시"}</figcaption>
      </figure>}
      {known && (known.id === "lHam" || known.id === "rHam") && <p className="body-part-focus-dialog__hint">허벅지 뒤 근육 · 햄스트링</p>}

      {target.kind === "other" && <div className="body-part-focus-dialog__custom-fields">
        <div className="body-part-focus-dialog__field">
          <label htmlFor={nameInputId}>부위 이름</label>
          <input
            id={nameInputId}
            ref={nameInputRef}
            type="text"
            value={customName}
            maxLength={OTHER_BODY_PART_LABEL_LIMIT}
            autoComplete="off"
            aria-invalid={validationMessage !== "" && invalidCustomMetadata ? "true" : undefined}
            aria-describedby={validationField !== "" && validationField !== "note" ? `${nameInputId}-error` : `${nameInputId}-hint`}
            onChange={event => {
              const next = event.target.value
              setCustomName(next)
              setValidationMessage("")
              if (recentSelection && next !== recentSelection.label) {
                setCustomId(undefined)
                setRecentSelection(null)
              }
            }}
          />
          <p id={`${nameInputId}-hint`} className="body-part-focus-dialog__hint">
            {customName.length}/{OTHER_BODY_PART_LABEL_LIMIT}자
          </p>
          {validationMessage !== "" && validationField !== "note" && <p id={`${nameInputId}-error`} className="body-part-focus-dialog__error" role="alert">
            {validationMessage}
          </p>}
          {matchingRecentPart && customId !== matchingRecentPart.id && <button
            type="button"
            className="app-choice-control body-part-focus-dialog__reuse-choice"
            onClick={() => {
              setCustomId(matchingRecentPart.id)
              setCustomNote("")
              setCurrentLevel(0)
              setRecentSelection({ id: matchingRecentPart.id, label: matchingRecentPart.labelSnapshot })
              setValidationMessage("")
              setValidationField("")
            }}
          >최근 이름 “{matchingRecentPart.labelSnapshot}” 재사용</button>}
        </div>
        <details className="body-part-focus-dialog__memo-details" open={memoOpen} onToggle={event => setMemoOpen(event.currentTarget.open)}>
          <summary>메모 추가 <span>선택</span><ChevronDown size={18} aria-hidden="true" /></summary>
          <div className="body-part-focus-dialog__field">
            <label htmlFor={noteInputId}>메모</label>
            <textarea
              id={noteInputId}
              value={customNote}
              maxLength={OTHER_BODY_PART_NOTE_LIMIT}
              rows={2}
              aria-invalid={validationField === "note" ? "true" : undefined}
              aria-describedby={validationField === "note" ? `${noteInputId}-error` : `${noteInputId}-hint`}
              onChange={event => { setCustomNote(event.target.value); setValidationMessage(""); setValidationField("") }}
            />
            <p id={`${noteInputId}-hint`} className="body-part-focus-dialog__hint">
              {customNote.length}/{OTHER_BODY_PART_NOTE_LIMIT}자
            </p>
            {validationField === "note" && validationMessage !== "" && <p id={`${noteInputId}-error`} className="body-part-focus-dialog__error" role="alert">
              {validationMessage}
            </p>}
          </div>
        </details>
        {target.recentCustomParts.length > 0 && <div className="body-part-focus-dialog__recent">
          <p className="body-part-focus-dialog__recent-title">최근 기록한 이름</p>
          <div className="body-part-focus-dialog__recent-list" role="group" aria-label="최근 기록한 부위 이름">
            {target.recentCustomParts.map(candidate => (
              <button key={candidate.id} type="button" className="app-choice-control body-part-focus-dialog__recent-choice"
                aria-pressed={recentSelection?.id === candidate.id}
                onClick={() => {
                  setCustomName(candidate.labelSnapshot)
                  setCustomNote("")
                  setCustomId(candidate.id)
                  setCurrentLevel(0)
                  setRecentSelection({ id: candidate.id, label: candidate.labelSnapshot })
                  setValidationMessage("")
                  nameInputRef.current?.focus({ preventScroll: true })
                }}>
                {candidate.labelSnapshot}
              </button>
            ))}
          </div>
        </div>}
      </div>}

      <p className="body-part-focus-dialog__question">통증은 어느 정도인가요?</p>
      <p id={scaleDescriptionId} className="body-part-focus-dialog__scale-range">
        <span>약함</span><span aria-hidden="true">→</span><span>심함</span>
      </p>
      <div className="body-part-focus-dialog__levels" role="group" aria-label="통증 정도" aria-describedby={scaleDescriptionId}>
        {[1, 2, 3, 4, 5].map(value => (
          <button key={value} type="button" className="app-choice-control body-part-focus-dialog__level"
            aria-label={`${target.kind === "known" ? target.part.name : customName.trim() || "기타 부위"} 통증 ${value}단계`}
            aria-pressed={currentLevel === value}
            ref={node => { if (node) levelRefs.current.set(value, node); else levelRefs.current.delete(value) }}
            onClick={() => {
              if (target.kind === "known") handleSelectLevel(value)
              else { setCurrentLevel(value); setValidationMessage(""); setValidationField("") }
            }}>
            <span>{value}</span>{currentLevel === value && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {target.kind === "other" && <button type="button" className="app-choice-control body-part-focus-dialog__apply"
        disabled={currentLevel === 0} onClick={() => handleSelectLevel(currentLevel)}>
        {target.currentLevel > 0 ? "변경 적용" : "추가"}
      </button>}
        {target.currentLevel > 0 && <button type="button" className="app-text-button body-part-focus-dialog__clear"
          aria-label={target.kind === "known"
            ? `${target.part.name} 선택 취소`
            : `${customName.trim() || "기타 부위"} 선택 취소`}
          onClick={() => handleSelectLevel(0)}>
          선택 취소
        </button>}
    </Frame>
  )
}
