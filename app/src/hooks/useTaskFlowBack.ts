import React from "react"
import { registerBrowserBackLayer } from "../navigation/browserNavigation"
import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"

/** One opaque Back entry per active flow, not a second router or stored answer history. */
export function useTaskFlowBack({ enabled, busy = false, onBack }: {
  readonly enabled: boolean
  readonly busy?: boolean
  readonly onBack: () => void
}): void {
  const id = React.useId()
  const latest = React.useRef({ enabled, busy, onBack })
  latest.current = { enabled, busy, onBack }
  const [backRevision, rearm] = React.useReducer((revision: number) => revision + 1, 0)

  React.useLayoutEffect(() => {
    if (!enabled) return
    let alive = true
    const scope = localJournalScopeGeneration()
    const layer = registerBrowserBackLayer({
      id: `task-flow-${id}`,
      canClose: () => !alive || scope !== localJournalScopeGeneration() || !latest.current.busy,
      onClose: () => {
        if (!alive || scope !== localJournalScopeGeneration() || !latest.current.enabled || latest.current.busy) return
        latest.current.onBack()
        rearm()
      },
    })
    return () => { alive = false; layer.dispose() }
    // Changing an answer or opening help must NOT push a new sentinel above an
    // existing dialog. Rearm only after this flow actually consumed native Back.
  }, [enabled, backRevision, id])
}
