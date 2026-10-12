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
