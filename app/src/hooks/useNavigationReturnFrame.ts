import React from "react"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { getBrowserNavigationEpoch } from "../navigation/browserNavigation"

/** A return position belongs to one navigation and one account lifetime. */
export function useNavigationReturnFrame() {
  const frame = React.useRef<number | null>(null)
  const generation = React.useRef(0)

  const invalidate = React.useCallback(() => {
    generation.current += 1
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const schedule = React.useCallback((restore: () => void) => {
    invalidate()
    const expectedGeneration = generation.current
    const expectedNavigation = getBrowserNavigationEpoch()
    const expectedScope = localJournalScopeGeneration()
    frame.current = window.requestAnimationFrame(() => {
      if (generation.current !== expectedGeneration) return
      frame.current = null
      if (getBrowserNavigationEpoch() !== expectedNavigation
        || localJournalScopeGeneration() !== expectedScope) return
      restore()
    })
  }, [invalidate])

  React.useEffect(() => {
    const unsubscribe = onLocalJournalScopeChange(invalidate)
    return () => { unsubscribe(); invalidate() }
  }, [invalidate])

  return { schedule, invalidate }
}
