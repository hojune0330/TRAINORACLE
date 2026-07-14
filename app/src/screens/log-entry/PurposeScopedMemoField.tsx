import React from "react"
import { MEMO_PURPOSE } from "../../domain/journal-schema"
import type { MemoPurpose } from "../../domain/journal-schema"
import { assessPurposeScopedMemo } from "../../safety/memo-safety"
import { inputStyle } from "./shared"

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

export function usePurposeScopedMemo(): PurposeScopedMemoController {
  const [text, setText] = React.useState("")
  const [purpose, setPurpose] = React.useState<MemoPurpose>()
  const [purposeError, setPurposeError] = React.useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = React.useState<string | null>(null)
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
  }
}

export function PurposeScopedMemoField({
  controller,
  fieldId,
  label,
  placeholder,
  rows = 3,
}: {
  readonly controller: PurposeScopedMemoController
  readonly fieldId: string
  readonly label: string
  readonly placeholder?: string
  readonly rows?: number
}) {
  const explanationId = `${fieldId}-purpose-explanation`
  const errorId = `${fieldId}-purpose-error`
  const describedBy = controller.purposeError === null
    ? explanationId
    : `${explanationId} ${errorId}`

  return (
    <div>
      <fieldset aria-describedby={describedBy} style={{ border: 0, margin: "0 0 10px", padding: 0 }}>
        <legend style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", marginBottom: 7 }}>
          메모 용도
        </legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <label style={optionStyle(controller.purpose === MEMO_PURPOSE.privateSelfOnly)}>
            <input
              ref={controller.privateOptionRef}
              type="radio"
              name={`${fieldId}-purpose`}
              checked={controller.purpose === MEMO_PURPOSE.privateSelfOnly}
              onChange={() => controller.choosePurpose(MEMO_PURPOSE.privateSelfOnly)}
            />
            나만의 메모
          </label>
          <label style={optionStyle(controller.purpose === MEMO_PURPOSE.analyzableTrainingNote)}>
            <input
              type="radio"
              name={`${fieldId}-purpose`}
              checked={controller.purpose === MEMO_PURPOSE.analyzableTrainingNote}
              onChange={() => controller.choosePurpose(MEMO_PURPOSE.analyzableTrainingNote)}
            />
            훈련 메모
          </label>
        </div>
      </fieldset>
      <div id={explanationId} style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 8 }}>
        {purposeExplanation(controller.purpose)}
      </div>
      {controller.purposeError !== null && (
        <div id={errorId} role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--pain-5)", marginBottom: 8 }}>
          {controller.purposeError}
        </div>
      )}
      <label htmlFor={fieldId} style={{ display: "block", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", marginBottom: 6 }}>
        {label}
      </label>
      <textarea
        id={fieldId}
        value={controller.text}
        onChange={(event) => controller.updateText(event.target.value)}
        onBlur={controller.reviewIfNeeded}
        placeholder={placeholder}
        rows={rows}
        className="paper-grid"
        style={{
          ...inputStyle(), fontFamily: '"Caveat", "Gowun Dodum", cursive',
          fontSize: 18, lineHeight: 1.4, color: "var(--ink-blue)", resize: "none",
        }}
      />
      {controller.reviewMessage !== null && (
        <div role="status" style={{ marginTop: 8, padding: "9px 10px", border: "1px solid var(--warn)", fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
          {controller.reviewMessage} 저장은 이 기기에만 됩니다.
        </div>
      )}
    </div>
  )
}

function purposeExplanation(purpose: MemoPurpose | undefined): string {
  if (purpose === MEMO_PURPOSE.privateSelfOnly) {
    return "원문은 이 기기에만 남고 분석하지 않아요."
  }
  if (purpose === MEMO_PURPOSE.analyzableTrainingNote) {
    return "저장 전에 이 기기에서만 잠시 검토해요. 원문은 기기에만 남고 훈련 계획의 근거로 쓰지 않아요."
  }
  return "글을 적는다면 용도를 먼저 선택해 주세요. 원문은 이 기기에만 남아요."
}

function optionStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 7, padding: "9px 10px",
    border: selected ? "1px solid var(--ink)" : "1px solid var(--line)",
    background: selected ? "var(--surface)" : "transparent",
    fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink)", cursor: "pointer",
  }
}
