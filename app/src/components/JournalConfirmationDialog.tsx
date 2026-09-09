import React from "react"

type JournalConfirmationDialogProps = {
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly returnFocusTo?: () => HTMLElement | null
  readonly onCancel: () => void
  readonly onConfirm: () => boolean | Promise<boolean>
}

export function JournalConfirmationDialog({
  title,
  description,
  confirmLabel,
  returnFocusTo,
  onCancel,
  onConfirm,
}: JournalConfirmationDialogProps) {
  const titleId = React.useId()
  const descriptionId = React.useId()
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const confirmedRef = React.useRef(false)
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const [failed, setFailed] = React.useState(false)
  const onCancelRef = React.useRef(onCancel)
  onCancelRef.current = onCancel
  const capturedReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const returnFocusRef = React.useRef<() => HTMLElement | null>(
    returnFocusTo ?? (() => capturedReturnFocus),
  )

  React.useEffect(() => {
    cancelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        if (!busyRef.current) onCancelRef.current()
        return
      }
      if (event.key !== "Tab") return

      const first = cancelRef.current
      const last = confirmRef.current
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (!confirmedRef.current) {
        window.setTimeout(() => {
          const returnTarget = returnFocusRef.current()
          if (returnTarget?.isConnected) returnTarget.focus()
        }, 0)
      }
    }
  }, [])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="journal-confirmation"
      data-testid="journal-delete-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onCancel()
      }}
    >
      <div className="journal-confirmation__surface">
        <h2 id={titleId} className="journal-confirmation__title">{title}</h2>
        <p id={descriptionId} className="journal-confirmation__description">{description}</p>
        {failed && <p role="alert">처리하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>}
        <div className="journal-confirmation__actions">
          <button
            ref={cancelRef}
            type="button"
            className="journal-confirmation__button"
            data-testid="journal-delete-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            취소
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="journal-confirmation__button journal-confirmation__button--danger"
            data-testid="journal-delete-confirm"
            disabled={busy}
            onClick={() => {
              if (busyRef.current) return
              setFailed(false)
              busyRef.current = true
              try {
                const result = onConfirm()
                if (typeof result === "boolean") {
                  confirmedRef.current = result
                  busyRef.current = false
                } else {
                  setBusy(true)
                  void result.then(ok => { confirmedRef.current = ok })
                    .catch(() => setFailed(true))
                    .finally(() => { busyRef.current = false; setBusy(false) })
                }
              } catch {
                busyRef.current = false
                setFailed(true)
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
