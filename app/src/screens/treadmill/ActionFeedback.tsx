import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronsRight, Clock3 } from 'lucide-react'
import type { ActionCue } from './action-feedback'

export function useActionFeedback() {
  const [cue, setCue] = useState<(ActionCue & { id: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(), sequence = useRef(0)
  const clear = useCallback(() => { clearTimeout(timer.current); setCue(null) }, [])
  const show = useCallback((next: ActionCue | null) => {
    if (!next) return
    clearTimeout(timer.current)
    setCue({ ...next, id: ++sequence.current })
    timer.current = setTimeout(() => setCue(null), next.kind === 'wait' ? 1400 : 650)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { cue, show, clear }
}
export function ActionFeedback({ cue }: { readonly cue: (ActionCue & { id: number }) | null }) {
  const Icon = cue?.kind === 'jump' ? ArrowUp : cue?.kind === 'dash' ? ChevronsRight : Clock3
  return <div className="game-action-feedback" role="status" aria-live="polite" aria-atomic="true">
    {cue && <div key={cue.id} className="game-action-feedback__cue" data-kind={cue.kind}>
      <Icon size={22} aria-hidden="true" /><span><strong>{cue.text}</strong><small>{cue.detail}</small></span>
    </div>}
  </div>
}
