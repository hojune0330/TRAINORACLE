type DraftGuard = {
  isUnsafe: () => boolean
  onBlocked: () => void
  confirmDiscard?: () => boolean
  discard?: () => void
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

export function runDraftSafeNavigation(navigate: () => void): boolean {
  const unsafe = [...guards].filter(guard => guard.isUnsafe())
  let blocked = false
  for (const guard of unsafe) {
    if (!guard.confirmDiscard) {
      blocked = true
      guard.onBlocked()
    }
  }
  if (blocked) return false
  // Never discard volatile input while another owner/storage guard blocks leaving.
  if (unsafe.some(guard => !guard.confirmDiscard?.())) return false
  unsafe.forEach(guard => guard.discard?.())
  navigate()
  return true
}
