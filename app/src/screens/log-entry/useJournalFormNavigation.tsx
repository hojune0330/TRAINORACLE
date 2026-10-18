import React from "react"
import { X } from "lucide-react"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { hasPendingBrowserBackLayer } from "../../navigation/browserNavigation"
import { localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"
import type { useFormInputDraft } from "./useFormInputDraft"
import "./journal-form-navigation.css"

type Draft = ReturnType<typeof useFormInputDraft>

/** The form owns validation and persistence. Navigation never invents a draft save. */
export function useJournalFormNavigation({ draft, onBack, onExit, onSave, flowEnabled, onStepBack, busy, rootBackEnabled = false }: {
  draft: Draft
  onBack?: (() => void) | undefined
  onExit?: (() => void) | undefined
  onSave: () => void
  flowEnabled: boolean
  onStepBack: () => void
  busy: boolean
  rootBackEnabled?: boolean | undefined
}) {
  const [exitTarget, setExitTarget] = React.useState<{ action: () => void } | null>(null)
  const [departure, setDeparture] = React.useState<{ action: () => void } | null>(null)
  const scope = React.useRef(localJournalScopeGeneration())
  const alive = React.useRef(true)
  React.useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // A safely buffered conflict may be left even though saving is unavailable.
  // Scope/lifetime authority and permission to save are different checks.
  const current = () => alive.current && scope.current === localJournalScopeGeneration()
  useTaskFlowBack({ enabled: (flowEnabled || rootBackEnabled) && departure === null, busy,
    onBack: () => flowEnabled ? onStepBack() : request(onExit ?? onBack) })
  // Drain the form's asynchronous native Back before returning to its origin.
  React.useEffect(() => {
    if (departure === null) return
    let active = true
    const finish = () => {
      if (!active || hasPendingBrowserBackLayer()) return
      active = false
      if (current()) departure.action()
    }
    window.addEventListener("popstate", finish)
    queueMicrotask(finish)
    return () => { active = false; window.removeEventListener("popstate", finish) }
  }, [departure])
  const finish = (action: () => void) => setDeparture({ action })
  const request = (action: (() => void) | undefined) => {
    if (busy || departure !== null || !current()) return
    const leave = () => action?.()
    if (draft.hasChanges()) setExitTarget({ action: leave })
    else draft.back(() => finish(leave))()
  }
  return {
    finish,
    back: () => request(onBack),
    exit: () => request(onExit ?? onBack),
    dialog: exitTarget === null ? null : <JournalExitDialog accountDraft={draft.hasSavedDraft}
      onClose={() => setExitTarget(null)}
      onSave={() => { if (current()) onSave() }}
      onDiscard={() => draft.leaveWithoutSaving(() => finish(exitTarget.action))} />,
  }
}

function JournalExitDialog({ accountDraft, onClose, onSave, onDiscard }: {
  accountDraft: boolean; onClose: () => void; onSave: () => void; onDiscard: () => void
}) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const title = React.useId()
  const description = React.useId()
  const pending = React.useRef<(() => void) | null>(null)
  const chosen = React.useRef(false)
  const close = useReaderDialog(dialog, () => {
    const action = pending.current
    pending.current = null
    onClose()
    // Reader cleanup must precede validation focus and the form's Back drain.
    queueMicrotask(() => action?.())
  })
  const choose = (action?: () => void) => {
    if (chosen.current) return
    chosen.current = true
    pending.current = action ?? null
    close()
  }
  return <dialog ref={dialog} className="journal-exit-dialog" aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); choose() }}>
    <header>
      <h2 id={title}>작성 중인 기록을 저장할까요?</h2>
      <button type="button" className="journal-exit-dialog__close" aria-label="계속 작성" onClick={() => choose()}><X size={20} aria-hidden="true" /></button>
    </header>
    <p id={description}>{accountDraft ? "보관된 초안은 지우지 않아요." : "저장 없이 나가면 입력한 내용은 사라져요."}</p>
    <div className="journal-exit-dialog__actions">
      <button type="button" className="quick-log__primary" onClick={() => choose(onSave)}>저장하고 나가기</button>
      <button type="button" className="quick-log__secondary" onClick={() => choose()}>계속 작성하기</button>
      <button type="button" className="journal-exit-dialog__discard" onClick={() => choose(onDiscard)}>저장 없이 나가기</button>
    </div>
  </dialog>
}
