import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { LogDetail } from "./LogDetail"
import type { PostSessionEntry } from "../domain/journal-schema"

const entry: PostSessionEntry = { id: "share-test", kind: "post-session", date: "2026-10-26", savedAt: "2026-10-26T09:00:00Z", syncState: "local", title: "운동", system: "base", distanceKm: "4.6", durationMin: "30", avgPace: "", rpe: 4, memo: "" }
beforeEach(async () => { localStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(cleanup)

it("offers a share card on a fully loaded saved exercise without making storage writes", () => {
  render(<LogDetail date={entry.date} entries={[entry]} readComplete />)
  expect(screen.getByRole("button", { name: "공유 카드 만들기" })).toBeVisible()
})

it("does not expose export in read-only readers, incomplete reads, or a blank numeric entry", () => {
  const { rerender } = render(<LogDetail date={entry.date} entries={[entry]} readComplete readOnly />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
  rerender(<LogDetail date={entry.date} entries={[entry]} readComplete={false} />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
  rerender(<LogDetail date={entry.date} entries={[{ ...entry, distanceKm: "", durationMin: "" }]} readComplete />)
  expect(screen.queryByRole("button", { name: "공유 카드 만들기" })).toBeNull()
})
