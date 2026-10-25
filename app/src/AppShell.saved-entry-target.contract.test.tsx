import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { LogEntryProps } from "./screens/LogEntry"
import { deleteEntry, saveEntry, type JournalEntry } from "./domain/journal-store"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

const state = vi.hoisted(() => ({ entry: { id: "saved-target", kind: "post-session", date: "2026-10-25", savedAt: "2026-10-25T08:00:00Z",
  syncState: "local", title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0 } as JournalEntry }))
vi.mock("./screens/Home", () => ({ Home: ({ onWriteLog }: { onWriteLog: (kind: "post-session" | "quick-session") => void }) => <>
  <button onClick={() => onWriteLog("post-session")}>자세한 기록 시작</button>
  <button onClick={() => onWriteLog("quick-session")}>빠른 기록 시작</button></> }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({ onDone, onSaved }: LogEntryProps) => <>
  <button onClick={() => { expect(saveEntry(state.entry).ok).toBe(true); onDone?.("post-session", state.entry) }}>자세한 기록 저장</button>
  <button onClick={() => { expect(saveEntry(state.entry).ok).toBe(true); onSaved?.(state.entry) }}>빠른 기록 저장</button></> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: { PlanProposalInbox: () => null,
  JournalDayReader: ({ initialEntryId, date }: { initialEntryId?: string; date: string }) =>
    <section aria-label="저장한 기록 대상"><output aria-label="대상 ID">{initialEntryId ?? "없음"}</output><output aria-label="대상 날짜">{date}</output></section>,
} }))
import { AppShell } from "./AppShell"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); await initializeCanonicalJournalFixture()
  window.history.replaceState(null, "", "/?app=1")
  expect(saveEntry({ ...state.entry, id: "same-day-other", savedAt: "2026-10-25T09:00:00Z" }).ok).toBe(true)
})
afterEach(() => { cleanup(); setActiveLocalAccount(null) })

it.each(["자세한", "빠른"] as const)("opens the exact saved identity after %s recording among same-day entries", kind => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: `${kind} 기록 시작` }))
  fireEvent.click(screen.getByRole("button", { name: `${kind} 기록 저장` }))
  fireEvent.click(screen.getByRole("button", { name: "기록 보기" }))
  expect(screen.getByLabelText("대상 ID")).toHaveTextContent("saved-target")
  expect(screen.getByLabelText("대상 날짜")).toHaveTextContent(state.entry.date)
})

it("does not substitute another same-day entry when the exact saved identity has been removed", () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "자세한 기록 시작" }))
  fireEvent.click(screen.getByRole("button", { name: "자세한 기록 저장" }))
  act(() => { expect(deleteEntry(state.entry.id).ok).toBe(true) })
  fireEvent.click(screen.getByRole("button", { name: "기록 보기" }))
  expect(screen.queryByRole("region", { name: "저장한 기록 대상" })).toBeNull()
})
