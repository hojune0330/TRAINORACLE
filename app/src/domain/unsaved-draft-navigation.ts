type DraftGuard = { isUnsafe: () => boolean; onBlocked: () => void }

const guards = new Set<DraftGuard>()

/** Only volatile input blocks navigation; durable offline drafts can be left safely. */
export function registerUnsavedDraftGuard(guard: DraftGuard) {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export function runDraftSafeNavigation(navigate: () => void): boolean {
  let blocked = false
  for (const guard of guards) {
    if (guard.isUnsafe()) {
      blocked = true
      guard.onBlocked()
    }
  }
  if (blocked) return false
  navigate()
  return true
}
