import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { PostSessionForm } from "./PostSessionForm"
import { EveningCheckin } from "./EveningCheckin"
import { RaceForm } from "./RaceForm"
import { loadEntries } from "../../domain/journal-store"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)
for (const [name, Form] of [["post", PostSessionForm], ["evening", EveningCheckin], ["race", RaceForm]] as const) {
  it(`does not store a completely blank ${name} entry or invoke its saved callback`, () => {
    const done = vi.fn()
    render(<Form onDone={done} />)
    if (name === "evening") fireEvent.click(screen.getByRole("button", { name: "수면" }))
    fireEvent.click(screen.getByRole("button", { name: name === "evening" ? "입력 확인으로" : "지금 입력 확인" }))
    if (name === "evening") {
      expect(screen.queryByRole("button", { name: /^저장/u })).toBeNull()
      expect(screen.getByText("남길 항목을 골라 주세요.")).toBeVisible()
    } else {
      fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
      expect(screen.getByRole("alert")).toHaveTextContent("아직 입력한 내용이 없어요")
    }
    expect(loadEntries()).toHaveLength(0)
    expect(done).not.toHaveBeenCalled()
  })
}
it("still saves a single selected mood without requiring other measurements", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "기분" }))
  fireEvent.click(screen.getByRole("button", { name: "기분 4 좋음" }))
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ mood: 4, fieldProvenance: { sleepH: { provenance: "MISSING" } } })
})


beforeEach(async () => {
  await initializeCanonicalJournalFixture()
})
