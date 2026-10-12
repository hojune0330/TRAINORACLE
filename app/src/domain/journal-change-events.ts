export const LOCAL_JOURNALS_CHANGED = "trainoracle:local-journals-changed"

/** Payload-free invalidation; readers still enforce the active account scope. */
export function announceLocalJournalChange(): void {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_JOURNALS_CHANGED))
  } catch {
    // UI notifications must never turn a confirmed storage write into a failure.
  }
}
