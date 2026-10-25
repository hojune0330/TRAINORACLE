import React from "react"
import { localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"
import { hasActiveBrowserBackLayer, registerBrowserBackLayer } from "../../navigation/browserNavigation"
import "./full-export-dialog.css"

export function FullExportDialog({ onClose, onConfirm }: {
  readonly onClose: () => void
  readonly onConfirm: () => void
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const closeLayerRef = React.useRef<(() => void) | null>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  const confirmed = React.useRef(false)

  React.useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const scope = localJournalScopeGeneration()
    const overflow = document.body.style.overflow
    const layer = registerBrowserBackLayer({
      id: `full-export-${titleId}`,
      canClose: () => true,
      onClose: () => onCloseRef.current(),
    })
    closeLayerRef.current = layer.close
    document.body.style.overflow = "hidden"
    dialog?.showModal()
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      closeLayerRef.current = null
      layer.dispose()
      if (dialog?.open) dialog.close()
      document.body.style.overflow = overflow
      if (scope === localJournalScopeGeneration() && !hasActiveBrowserBackLayer() && opener?.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [titleId])

  return <dialog ref={dialogRef} className="journal-confirmation__surface full-export-dialog"
    aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); closeLayerRef.current?.() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) closeLayerRef.current?.()
    }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeLayerRef.current?.()
      } else if (event.key === "Tab") {
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault(); confirmRef.current?.focus()
        } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
          event.preventDefault(); cancelRef.current?.focus()
        }
      }
    }}>
    <h2 id={titleId} className="journal-confirmation__title">메모까지 포함할까요?</h2>
    <p id={descriptionId} className="journal-confirmation__description">
      이 파일에는 메모 원문과 메모 목적이 함께 들어가요. 받을 사람을 확인한 뒤 파일을 만들어요.
    </p>
    <div className="journal-confirmation__actions">
      <button ref={cancelRef} type="button" className="journal-confirmation__button" onClick={() => closeLayerRef.current?.()}>취소</button>
      <button ref={confirmRef} type="button" className="journal-confirmation__button full-export-dialog__confirm" onClick={() => {
        if (confirmed.current) return
        confirmed.current = true
        closeLayerRef.current?.()
        onConfirm()
      }}>파일 만들기</button>
    </div>
  </dialog>
}
