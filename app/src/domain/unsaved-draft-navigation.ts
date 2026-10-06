type DraftGuard = {
  isUnsafe: () => boolean
  onBlocked: () => void
  confirmDiscard?: () => boolean
  discard?: () => void
  requestNavigation?: (resume: () => void) => void
  /** A mounted plan may be temporarily hidden, never discarded, while recording. */
  canPreserveMountedDraft?: () => boolean
}

const guards = new Set<DraftGuard>()

/** Automatic recovery must never ask to discard input or infer safety after a guard fails. */
export function hasUnsafeDrafts(): boolean {
  try { return [...guards].some(guard => guard.isUnsafe()) }
  catch { return true }
}

/** Only volatile input blocks navigation; durable offline drafts can be left safely. */
export function registerUnsavedDraftGuard(guard: DraftGuard) {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export function runDraftSafeNavigation(navigate: () => void, preserveMountedDrafts = false, isCurrent: () => boolean = () => true): boolean {
  let finished = false
  let running = false
  let navigated = false
  const requested = new Set<DraftGuard>()
  const current = () => {
    if (finished) return false
    try { if (isCurrent()) return true } catch { /* A failed authority check is unsafe. */ }
    finished = true
    return false
  }
  const run = (): void => {
    if (running || !current()) return
    running = true
    let resumeSynchronously = false
    try {
      const unsafe: DraftGuard[] = []
      for (const guard of [...guards]) {
        if (!current()) return
        if (!guards.has(guard)) continue
        const needsDecision = guard.isUnsafe()
        if (!current()) return
        if (needsDecision && guards.has(guard)) {
          if (preserveMountedDrafts) {
            const preserved = guard.canPreserveMountedDraft?.()
            if (!current()) return
            if (preserved) continue
          }
          unsafe.push(guard)
        }
      }
      let blocked = false
      for (const guard of unsafe) {
        if (!current()) return
        if (guards.has(guard) && !guard.confirmDiscard && !guard.requestNavigation) {
          blocked = true
          guard.onBlocked()
          if (!current()) return
        }
      }
      if (blocked) { finished = true; return }
      const interactive = unsafe.find(guard => guards.has(guard) && guard.requestNavigation)
      if (interactive) {
        // One attempt must not reopen the same decision or recurse forever when
        // a consumer calls resume synchronously without making its input safe.
        if (requested.has(interactive)) { finished = true; return }
        requested.add(interactive)
        let consumed = false
        if (!current()) return
        interactive.requestNavigation?.(() => {
          if (consumed) return
          consumed = true
          if (!current()) return
          if (running) resumeSynchronously = true
          else run()
        })
        if (!current()) return
        return
      }
      // Confirm every owner before discarding any volatile input. Check each
      // callback boundary: a callback itself may invalidate the producer.
      for (const guard of unsafe) {
        if (!current()) return
        if (!guards.has(guard)) continue
        const confirmed = guard.confirmDiscard?.()
        if (!current()) return
        if (!confirmed) { finished = true; return }
      }
      for (const guard of unsafe) {
        if (!current()) return
        if (!guards.has(guard)) continue
        guard.discard?.()
        if (!current()) return
      }
      if (!current()) return
      finished = true // Consume the attempt before navigate can re-enter callbacks.
      navigate()
      navigated = true
    } catch {
      finished = true // A broken storage/decision guard never permits leaving.
    } finally {
      running = false
      if (resumeSynchronously && !finished) run()
    }
  }
  // Synchronous resume is drained after the consumer returns, not recursively
  // from inside its callback. The finally block runs even through early return.
  run()
  return navigated
}
