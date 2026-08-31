import { X } from "lucide-react"
import React from "react"
import { TEXT_INK_DEFINITIONS, TEXT_STICKER_MAX_LENGTH } from "../../domain/decorations"
import type { TextInkId } from "../../domain/decorations"

/*
 * 텍스트 스티커 입력 시트 (P5 계약 §2 U2): 하단 시트, 20자 카운터,
 * 잉크 6색 스와치(44px, aria-pressed), 확인 버튼 "붙이기"/"고치기".
 * 개행은 공백으로 치환한다 (T3) — 스티커는 한 줄만 허용.
 */
export function JournalTextStickerSheet({
  mode,
  initialText,
  initialInkId,
  onConfirm,
  onClose,
}: {
  readonly mode: "CREATE" | "EDIT"
  readonly initialText: string
  readonly initialInkId: TextInkId
  readonly onConfirm: (text: string, inkId: TextInkId) => void
  readonly onClose: () => void
}) {
  const [text, setText] = React.useState(initialText)
  const [inkId, setInkId] = React.useState<TextInkId>(initialInkId)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      /* 시트가 열려 있는 동안 Escape는 시트만 닫는다 — 편집기 전체 닫기로 새지 않게. */
      event.stopImmediatePropagation()
      onClose()
    }
    /* capture 단계에서 잡아 툴바의 window 핸들러보다 먼저 처리한다. */
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [onClose])

  const confirmable = text.trim().length > 0
  const confirmLabel = mode === "CREATE" ? "붙이기" : "고치기"

  const submit = () => {
    if (!confirmable) return
    onConfirm(text, inkId)
  }

  return (
    <div
      className="journal-text-sticker-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "CREATE" ? "글 스티커 만들기" : "글 스티커 고치기"}
      data-decoration-interaction="true"
      data-testid="journal-text-sticker-sheet"
    >
      <header>
        <strong>{mode === "CREATE" ? "글 스티커" : "글 스티커 고치기"}</strong>
        <button type="button" onClick={onClose} aria-label="글 스티커 입력 닫기"><X aria-hidden="true" size={18} /></button>
      </header>
      <div className="journal-text-sticker-sheet__field">
        <input
          ref={inputRef}
          type="text"
          value={text}
          maxLength={TEXT_STICKER_MAX_LENGTH}
          placeholder="한 줄로 적어 보세요"
          aria-label={`글 스티커 내용, 최대 ${TEXT_STICKER_MAX_LENGTH}자`}
          data-testid="journal-text-sticker-input"
          onChange={(event) => setText(event.target.value.replace(/[\r\n]+/gu, " ").slice(0, TEXT_STICKER_MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
            }
          }}
        />
        <small aria-live="polite" data-testid="journal-text-sticker-counter">{`${text.length}/${TEXT_STICKER_MAX_LENGTH}`}</small>
      </div>
      <div className="journal-text-sticker-sheet__inks" role="group" aria-label="글 스티커 색">
        {TEXT_INK_DEFINITIONS.map((ink) => (
          <button
            key={ink.id}
            type="button"
            className="journal-text-sticker-sheet__ink"
            style={{ "--text-ink": ink.color } as React.CSSProperties}
            aria-pressed={inkId === ink.id}
            aria-label={`${ink.name} 색`}
            onClick={() => setInkId(ink.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="journal-text-sticker-sheet__confirm"
        disabled={!confirmable}
        data-testid="journal-text-sticker-confirm"
        onClick={submit}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
