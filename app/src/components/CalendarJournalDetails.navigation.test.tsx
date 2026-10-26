import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CalendarJournalDetails } from "./CalendarJournalDetails"
import { JournalConfirmationDialog } from "./JournalConfirmationDialog"
import type { JournalEntry } from "../domain/journal-schema"
import { hasPendingBrowserBackLayer } from "../navigation/browserNavigation"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

vi.mock("../screens/LogDetail", () => ({ LogDetail: () => <div>synthetic original reader</div> }))

const entry: JournalEntry = { id: "synthetic-calendar-navigation", kind: "post-session", date: "2026-10-02",
  savedAt: "2026-10-02T09:00:00.000Z", syncState: "local", system: "", title: "synthetic", memo: "",
  distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})
afterEach(async () => {
  cleanup(); await Promise.resolve()
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  setActiveLocalAccount(null)
  vi.restoreAllMocks()
})

it.each(["date", "account"])("consumes the original layer on %s change instead of replacing it with a duplicate parent", async kind => {
  const parent = { parent: "synthetic-calendar" }
  const push = vi.spyOn(window.history, "pushState")
  const view = render(<CalendarJournalDetails entries={[entry]} date={entry.date} />)
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(await screen.findByText("synthetic original reader")).toBeVisible()
  if (kind === "date") view.rerender(<CalendarJournalDetails entries={[entry]} date="2026-10-03" />)
  else act(() => setActiveLocalAccount("synthetic-calendar-next-account"))
  await act(async () => { await Promise.resolve() })
  expect(screen.queryByText("synthetic original reader")).toBeNull()
  expect(window.history.back).toHaveBeenCalledTimes(1)
  expect(hasPendingBrowserBackLayer()).toBe(true)
  expect(push).toHaveBeenCalledTimes(1)
  window.history.replaceState(parent, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: parent }))
  expect(hasPendingBrowserBackLayer()).toBe(false)
  act(() => setActiveLocalAccount(null))
})

it("keeps a single original layer during StrictMode replay and stores no journal data in history", async () => {
  const push = vi.spyOn(window.history, "pushState")
  render(<React.StrictMode><CalendarJournalDetails entries={[entry]} date={entry.date} /></React.StrictMode>)
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(await screen.findByText("synthetic original reader")).toBeVisible()
  expect(push).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(window.history.state)).not.toContain(entry.id)
  expect(JSON.stringify(window.history.state)).not.toContain(entry.date)
  fireEvent.click(screen.getByRole("button", { name: "날짜 요약으로" }))
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  expect(screen.queryByText("synthetic original reader")).toBeNull()
})

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
  const originalState = window.history.state
  fireEvent.click(screen.getByRole("button", { name: "open confirmation" }))
  window.history.replaceState(originalState, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: originalState }))
  expect(screen.queryByRole("alertdialog")).toBeNull()
  expect(screen.getByText("synthetic original reader")).toBeVisible()
  window.history.replaceState({ parent: "synthetic-calendar" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  expect(screen.queryByText("synthetic original reader")).toBeNull()
  expect(screen.getByRole("button", { name: "일지·메모 원문 열기" })).toBeVisible()
})
