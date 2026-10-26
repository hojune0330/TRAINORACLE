import { initializeCanonicalJournalStorage } from "../domain/canonical-journal-storage"

/**
 * Prepare test storage through the production migration path before fixtures
 * seed canonical journal keys. The inline runner keeps unit tests deterministic
 * without bypassing migration validation or persistence checks.
 */
export async function initializeCanonicalJournalFixture(
  local: Storage = window.localStorage,
  session: Storage | undefined = window.sessionStorage,
): Promise<void> {
  const result = await initializeCanonicalJournalStorage(local, session, operation => operation())
  if (result.status !== "ready") {
    throw new Error(`CANONICAL_JOURNAL_FIXTURE_NOT_READY:${result.reason}`)
  }
}

/** Capture the initialized test baseline so a synchronous fixture reset keeps
 * canonical migration metadata ready without retaining writes from this test. */
export function captureCanonicalJournalFixtureReset(
  local: Storage = window.localStorage,
  session: Storage | undefined = window.sessionStorage,
): () => void {
  const snapshot = (storage: Storage | undefined): Array<[string, string]> => {
    if (storage === undefined) return []
    const values: Array<[string, string]> = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key === null) continue
      const value = storage.getItem(key)
      if (value !== null) values.push([key, value])
    }
    return values
  }
  const localBaseline = snapshot(local)
  const sessionBaseline = snapshot(session)
  return () => {
    local.clear()
    session?.clear()
    for (const [key, value] of localBaseline) local.setItem(key, value)
    for (const [key, value] of sessionBaseline) session?.setItem(key, value)
  }
}
