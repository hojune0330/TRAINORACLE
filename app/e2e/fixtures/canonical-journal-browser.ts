import { initializeCanonicalJournalStorage } from "../../src/domain/canonical-journal-storage"

/** Standalone browser fixtures use the same Web Locks/bootstrap path as the app. */
export async function initializeCanonicalJournalBrowserFixture(): Promise<void> {
  const result = await initializeCanonicalJournalStorage(window.localStorage, window.sessionStorage)
  if (result.status !== "ready") {
    throw new Error(`CANONICAL_JOURNAL_BROWSER_FIXTURE_NOT_READY:${result.reason}`)
  }
}
