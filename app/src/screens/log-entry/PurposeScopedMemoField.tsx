import React from "react"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { MEMO_PURPOSE } from "../../domain/journal-schema"
import type { MemoPurpose } from "../../domain/journal-schema"
import { assessPurposeScopedMemo } from "../../safety/memo-safety"
import { inputStyle } from "./input-style"
import { loadSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { PrivateMemoSaveSetup } from "./PrivateMemoSaveSetup"
import "./memo-input.css"

export type PurposeScopedMemoController = {
  readonly text: string
  readonly purpose: MemoPurpose | undefined
  readonly purposeError: string | null
  readonly reviewMessage: string | null
  readonly privateOptionRef: React.RefObject<HTMLInputElement>
  readonly updateText: (text: string) => void
  readonly choosePurpose: (purpose: MemoPurpose) => void
  readonly reviewIfNeeded: () => void
  readonly prepareForSave: () => MemoSavePreparation
  readonly clearPreparationError: () => void
  readonly needsPrivateSetup: boolean
}

export type MemoSavePreparation = {
  readonly ready: boolean
  readonly reviewMessage: string | null
}

function reviewMessageFor(text: string, purpose: MemoPurpose | undefined): string | null {
  if (purpose !== MEMO_PURPOSE.analyzableTrainingNote || text.trim() === "") return null
  const assessment = assessPurposeScopedMemo(text, purpose)
  if (assessment === null || assessment.disposition === "D9_CLEARED") return null
  return assessment.disposition === "D9_ACTIVE"
    ? "안전과 관련된 표현이 감지됐어요. 자동 확인은 결론이 아니에요. 필요하면 지도자·보호자와 함께 확인해 주세요."
    : "자동 확인을 완료하지 못했어요. 안전 여부를 판정한 것이 아니에요. 필요하면 지도자·보호자와 함께 확인해 주세요."
}

export function usePurposeScopedMemo(
  initialText: string = "",
  initialPurpose?: MemoPurpose,
): PurposeScopedMemoController {
  const [text, setText] = React.useState(initialText)
  const [purpose, setPurpose] = React.useState<MemoPurpose | undefined>(initialPurpose)
  const [purposeError, setPurposeError] = React.useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = React.useState<string | null>(null)
  const [, refreshPrivateSetup] = React.useState(0)
  const privateOptionRef = React.useRef<HTMLInputElement>(null)

  const reviewIfNeeded = () => {
    setReviewMessage(reviewMessageFor(text, purpose))
  }

  const prepareForSave = () => {
    if (text.trim() !== "" && purpose === undefined) {
      setPurposeError("메모를 저장할 방법을 선택해 주세요.")
      privateOptionRef.current?.focus()
      return { ready: false, reviewMessage: null }
    }
    if (text.trim() !== "" && purpose === MEMO_PURPOSE.privateSelfOnly
      && !accountJournalRecordsEnabled() && loadSessionRecoveryCode() === null) {
      setPurposeError("나만의 메모를 저장하려면 아래에서 복구 코드를 준비해 주세요. 입력 내용은 그대로 남아 있어요.")
      privateOptionRef.current?.focus()
      return { ready: false, reviewMessage: null }
    }
    setPurposeError(null)
    const nextReviewMessage = reviewMessageFor(text, purpose)
    setReviewMessage(nextReviewMessage)
    return { ready: true, reviewMessage: nextReviewMessage }
  }

  return {
    text,
    purpose,
    purposeError,
    reviewMessage,
    privateOptionRef,
    needsPrivateSetup: purpose === MEMO_PURPOSE.privateSelfOnly
      && !accountJournalRecordsEnabled() && loadSessionRecoveryCode() === null,
    updateText: (nextText) => {
      setText(nextText)
      if (nextText.trim() === "") setPurposeError(null)
    },
    choosePurpose: (nextPurpose) => {
      setPurpose(nextPurpose)
      setPurposeError(null)
      if (nextPurpose === MEMO_PURPOSE.privateSelfOnly) setReviewMessage(null)
    },
    reviewIfNeeded,
    prepareForSave,
    clearPreparationError: () => { setPurposeError(null); refreshPrivateSetup(value => value + 1) },
  }
}

export function PurposeScopedMemoField({
  controller,
  fieldId,
  label,
  placeholder,
  rows = 3,
  textFirst = false,
  compactLabel = false,
  autoGrowMaxRows,
  onComposingChange,
}: {
  readonly controller: PurposeScopedMemoController
  readonly fieldId: string
  readonly label: string
  readonly placeholder?: string
  readonly rows?: number
  readonly textFirst?: boolean
  readonly compactLabel?: boolean
  readonly autoGrowMaxRows?: number
  readonly onComposingChange?: ((composing: boolean) => void) | undefined
}) {
  const accountEnabled = accountJournalRecordsEnabled()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => {
    const field = textareaRef.current
    if (!field || autoGrowMaxRows === undefined) return
    const resize = () => {
      const style = window.getComputedStyle(field)
      const lineHeight = Number.parseFloat(style.lineHeight) || 25.2
      const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
      const borders = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0)
      const minimum = rows * lineHeight + padding + borders
      const maximum = Math.max(rows, autoGrowMaxRows) * lineHeight + padding + borders
      field.style.height = "auto"
      field.style.height = `${Math.min(maximum, Math.max(minimum, field.scrollHeight + borders))}px`
      field.style.overflowY = field.scrollHeight + borders > maximum ? "auto" : "hidden"
    }
    resize()
    // Our height write also produces an observer notification. Re-measure only
    // a changed content width so growing the textarea cannot feed back forever.
    let observedWidth: number | undefined
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width === undefined || width === observedWidth) return
      observedWidth = width
      resize()
    })
    observer?.observe(field)
    window.addEventListener("resize", resize)
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize) }
  }, [controller.text, autoGrowMaxRows, rows])
  const revealMemo = () => {
    const field = textareaRef.current
    const saveBar = field?.closest(".app-scroll-region")?.querySelector(".entry-sticky-bar")
    if (field && saveBar && field.getBoundingClientRect().bottom > saveBar.getBoundingClientRect().top - 8) {
      field.scrollIntoView?.({ block: "center", behavior: "auto" })
    }
  }
  const explanationId = `${fieldId}-purpose-explanation`
  const errorId = `${fieldId}-purpose-error`
  const describedBy = controller.purposeError === null
    ? explanationId
    : `${explanationId} ${errorId}`
  const briefExplanation = <div id={explanationId}>
    {controller.purpose === MEMO_PURPOSE.analyzableTrainingNote && <p>이 기기에서 확인하며, 훈련 계획의 근거로 쓰지 않아요.</p>}
  </div>

  const memoTextField = <>
<label htmlFor={fieldId} className={compactLabel ? "home-hub__memo-label" : undefined} style={compactLabel ? undefined : { display: "block", fontSize: "var(--fs-body-sm)", color: "var(--ink-2)", marginBottom: 8 }}>
        {label}
      </label>
      <textarea
        ref={textareaRef}
        id={fieldId}
        value={controller.text}
        onFocus={revealMemo}
        onChange={(event) => controller.updateText(event.target.value)}
        onBlur={controller.reviewIfNeeded}
        onCompositionStart={() => onComposingChange?.(true)}
        onCompositionEnd={() => onComposingChange?.(false)}
        aria-describedby={describedBy}
        aria-invalid={controller.purposeError !== null}
        placeholder={placeholder}
        rows={rows}
        className="paper-grid"
        style={{
        ...inputStyle(), fontFamily: "var(--sans)",
          fontSize: compactLabel ? "max(16px, var(--fs-body))" : 18, lineHeight: compactLabel ? 1.5 : 1.4, color: "var(--ink-blue)", resize: "none",
        }}
      />
  </>
  return (
    <div className={`memo-input${compactLabel ? " memo-input--compact" : ""}`}>
      {textFirst && memoTextField}
      <fieldset className="memo-input__purpose" aria-describedby={describedBy}>
        <legend>
          메모 용도
        </legend>
        <div className="memo-input__purpose-options">
          <label className="memo-input__purpose-option" data-selected={controller.purpose === MEMO_PURPOSE.privateSelfOnly}>
            <input
              ref={controller.privateOptionRef}
              type="radio"
              aria-label="나만의 메모"
              aria-describedby={`${fieldId}-private-helper`}
              name={`${fieldId}-purpose`}
              checked={controller.purpose === MEMO_PURPOSE.privateSelfOnly}
              onChange={() => controller.choosePurpose(MEMO_PURPOSE.privateSelfOnly)}
            />
            <span className="memo-input__purpose-copy"><span className="memo-input__purpose-title">나만의 메모</span><small id={`${fieldId}-private-helper`}>공유·분석에 쓰지 않아요</small></span>
          </label>
          <label className="memo-input__purpose-option" data-selected={controller.purpose === MEMO_PURPOSE.analyzableTrainingNote}>
            <input
              type="radio"
              aria-label="훈련 메모"
              aria-describedby={`${fieldId}-training-helper`}
              name={`${fieldId}-purpose`}
              checked={controller.purpose === MEMO_PURPOSE.analyzableTrainingNote}
              onChange={() => controller.choosePurpose(MEMO_PURPOSE.analyzableTrainingNote)}
            />
            <span className="memo-input__purpose-copy"><span className="memo-input__purpose-title">훈련 메모</span><small id={`${fieldId}-training-helper`}>저장 전 내용을 자동 확인해요</small></span>
          </label>
        </div>
      </fieldset>
      <div className="memo-input__explanation">
        {briefExplanation}<details><summary>{textFirst ? "메모 보관 안내" : "보관 방식 자세히"}</summary><p>{purposeExplanation(controller.purpose, accountEnabled)}</p></details>
        {controller.needsPrivateSetup && <p>처음 한 번, 비밀 메모를 암호화해 보관할 복구 코드가 필요해요.</p>}
      </div>
      {controller.purposeError !== null && (
        <div id={errorId} role="alert" style={{ fontSize: "var(--fs-body-sm)", color: "var(--pain-5)", marginBottom: 8 }}>
          {controller.purposeError}
        </div>
      )}
      {!textFirst && memoTextField}
      {!accountEnabled && controller.purpose === MEMO_PURPOSE.privateSelfOnly && controller.text.trim() !== "" && (
        <PrivateMemoSaveSetup onReady={() => {
          controller.clearPreparationError()
          textareaRef.current?.focus({ preventScroll: true })
          textareaRef.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" })
          revealMemo()
        }} requested={controller.purposeError !== null} />
      )}
      {controller.reviewMessage !== null && (
        <div role="status" style={{ marginTop: 8, padding: 12, border: "1px solid var(--warn)", fontSize: "var(--fs-body-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
          {controller.reviewMessage} {accountEnabled ? "계정 저장 여부는 저장 결과에서 확인해 주세요." : "저장은 이 기기에만 됩니다."}
        </div>
      )}
    </div>
  )
}

function purposeExplanation(purpose: MemoPurpose | undefined, accountEnabled: boolean): string {
  if (accountEnabled) {
    const storage = "저장하면 원문을 암호화해 계정에 보관해요. 복구를 위해 서비스가 복호화할 수 있으며 종단간 암호화(E2EE)는 아니에요. 비밀 메모는 공유·분석에 사용하지 않아요."
    if (purpose === MEMO_PURPOSE.privateSelfOnly) return storage
    if (purpose === MEMO_PURPOSE.analyzableTrainingNote) {
      return `${storage} 저장 전 검토는 이 기기에서만 잠시 진행해요. 원문은 훈련 계획의 근거로 쓰지 않아요.`
    }
    return `글을 적는다면 용도를 먼저 선택해 주세요. ${storage}`
  }
  if (purpose === MEMO_PURPOSE.privateSelfOnly) {
    return "원문은 이 기기에만 남고 분석하지 않아요."
  }
  if (purpose === MEMO_PURPOSE.analyzableTrainingNote) {
    return "저장 전에 이 기기에서만 잠시 검토해요. 원문은 기기에만 남고 훈련 계획의 근거로 쓰지 않아요."
  }
  return "글을 적는다면 용도를 먼저 선택해 주세요. 원문은 이 기기에만 남아요."
}
