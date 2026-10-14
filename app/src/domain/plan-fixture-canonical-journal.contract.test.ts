import { afterEach, expect, it } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, saveCurrentRecord } from "./prescription-quality-matrix.test-fixtures"

afterEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })

it("keeps plan safety fail-closed until canonical journal fixture initialization completes", async () => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  const event = RUNTIME_CASES[3]!
  const selectedRecordId = saveCurrentRecord(event.eventDistanceM, event.performanceSeconds + 0.137)
  const intake = draftFor(event)

  expect(generatePlanFromDraft(intake, "NO_KNOWN_RISK", { selectedRecordId })).toEqual({
    kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW",
  })

  await initializeCanonicalJournalFixture()
  expect(generatePlanFromDraft(intake, "NO_KNOWN_RISK", { selectedRecordId }).kind).toBe("generated")
})
