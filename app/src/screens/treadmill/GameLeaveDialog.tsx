import { useEffect, useId, useRef } from "react"

export function GameLeaveDialog({ title, children, onCancel }: {
  readonly title: string; readonly children: React.ReactNode; readonly onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.showModal()
    return () => { ref.current?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="treadmill-game__leave-dialog" aria-labelledby={id}
    onCancel={event => { event.preventDefault(); onCancel() }}
    onClick={event => { if (event.target === event.currentTarget) onCancel() }}>
    <div className="treadmill-game__leave-content">
      <h2 id={id}>{title}</h2>{children}
      <button type="button" autoFocus className="treadmill-game__ghost" onClick={onCancel}>돌아가기</button>
    </div>
  </dialog>
}
