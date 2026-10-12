import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CalendarJournalDetails } from "./CalendarJournalDetails"
import { JournalConfirmationDialog } from "./JournalConfirmationDialog"
import type { JournalEntry } from "../domain/journal-schema"

vi.mock("../screens/LogDetail", () => ({ LogDetail: () => <div>synthetic original reader</div> }))

const entry: JournalEntry = { id: "synthetic-calendar-navigation", kind: "post-session", date: "2026-10-02",
  savedAt: "2026-10-02T09:00:00.000Z", syncState: "local", system: "", title: "synthetic", memo: "",
  distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks() })

function Harness() {
  const [confirmation, setConfirmation] = React.useState(false)
  return <>
    <CalendarJournalDetails entries={[entry]} date={entry.date} />
    <button onClick={() => setConfirmation(true)}>open confirmation</button>
    {confirmation && <JournalConfirmationDialog title="synthetic calendar top" description="synthetic" confirmLabel="confirm"
      onConfirm={() => false} onCancel={() => setConfirmation(false)} />}
  </>
}

it("keeps the calendar original open for a top confirmation POP and retains its normal Back", async () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(await screen.findByText("synthetic original reader")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "open confirmation" }))
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: { parent: "synthetic-calendar" } }))
  expect(screen.queryByRole("alertdialog")).toBeNull()
  expect(screen.getByText("synthetic original reader")).toBeVisible()
  fireEvent(window, new PopStateEvent("popstate", { state: null }))
  expect(screen.queryByText("synthetic original reader")).toBeNull()
  expect(screen.getByRole("button", { name: "일지·메모 원문 열기" })).toBeVisible()
})
