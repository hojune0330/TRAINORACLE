import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import { saveEntry } from "../domain/journal-store"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-storage-keys"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "../domain/account/account-journal-projection"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { JournalDayReader } from "./JournalDayReader"
import { LogDetail } from "./LogDetail"

const DATE = "2026-10-25"
function entry(id: string, hour: string, title = id): Extract<JournalEntry, { kind: "post-session" }> {
  return { id, kind: "post-session", date: DATE, savedAt: `${DATE}T${hour}:00:00Z`, syncState: "local",
    system: "", title, distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }
}
const first = entry("synthetic-first", "01")
const second = entry("synthetic-second", "02")
const third = entry("synthetic-third", "03")
const sectionForTitle = (title: string) => screen.getAllByText(title)[0]!.closest<HTMLElement>(".journal-entry-section")!

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null)
  await initializeCanonicalJournalFixture()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })

describe("live journal detail reads", () => {
  it.each([1, 3])("focuses the exact requested record after the decoration surface mounts with %s same-day records", async count => {
    const supplied = count === 1 ? [second] : [first, second, third]
    const { container } = render(<div className="app-scroll-region"><LogDetail date={DATE} entries={supplied} initialEntryId={second.id} /></div>)
    const target = sectionForTitle(second.title)
    await waitFor(() => {
      expect(target).toHaveAttribute("tabindex", "-1")
      expect(target).toHaveFocus()
    })
    expect(target).toHaveAttribute("data-open", "true")
    expect(container.querySelectorAll(".journal-entry-section[data-open='true']")).toHaveLength(1)
  })

  it.each(["storage", "focus", LOCAL_JOURNALS_CHANGED])("refreshes same-day additions and edits on %s while keeping the open entry and scroll", async event => {
    expect(saveEntry(first).ok).toBe(true)
    expect(saveEntry(second).ok).toBe(true)
    const { container } = render(<div className="app-scroll-region"><LogDetail date={DATE} initialEntryId={second.id} /></div>)
    const region = container.querySelector<HTMLElement>(".app-scroll-region")!
    const openEntry = sectionForTitle(second.title)
    const focusedControl = openEntry.querySelector<HTMLButtonElement>(".journal-entry-summary")!
    focusedControl.focus()
    region.scrollTop = 240

    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([first, second, third]))
    act(() => { window.dispatchEvent(new Event(event)) })
    expect(container.querySelectorAll(".journal-entry-section")).toHaveLength(3)
    expect(openEntry).toHaveAttribute("data-open", "true")
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "false")
    expect(sectionForTitle(third.title)).toHaveAttribute("data-open", "false")
    expect(focusedControl).toHaveFocus()
    expect(region.scrollTop).toBe(240)

    // Source order changes must not change a stable record's view identity.
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([third, { ...second, title: "synthetic edited second" }, first]))
    act(() => { window.dispatchEvent(new Event(event)) })
    expect(sectionForTitle("synthetic edited second")).toBe(openEntry)
    expect(openEntry).toHaveAttribute("data-open", "true")
    expect(focusedControl).toHaveFocus()
    expect(region.scrollTop).toBe(240)
  })

  it("renders the reader's supplied current entries and updates their values without replacing the navigator", () => {
    expect(saveEntry(third).ok).toBe(true)
    const props = { date: DATE, onDateChange: vi.fn(), onBack: vi.fn(), initialEntryId: second.id }
    const { rerender, container } = render(<JournalDayReader {...props} entries={[first, second]} />)
    const navigator = screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })
    expect(container.querySelectorAll(".journal-entry-section")).toHaveLength(2)
    expect(screen.queryAllByText(third.title)).toHaveLength(0)
    rerender(<JournalDayReader {...props} entries={[first, { ...second, title: "synthetic fresh second" }, third]} />)
    expect(screen.getByRole("navigation", { name: "날짜별 일지 넘기기" })).toBe(navigator)
    expect(container.querySelectorAll(".journal-entry-section")).toHaveLength(3)
    expect(sectionForTitle("synthetic fresh second")).toHaveAttribute("data-open", "true")
  })

  it("keeps a read-only supplied snapshot independent of local storage invalidations", () => {
    expect(saveEntry(third).ok).toBe(true)
    const supplied = [first]
    const { container } = render(<LogDetail date={DATE} entries={supplied} readOnly />)
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([{ ...first, title: "synthetic local replacement" }, third]))
    act(() => {
      for (const event of ["storage", "focus", LOCAL_JOURNALS_CHANGED]) window.dispatchEvent(new Event(event))
    })
    expect(container.querySelectorAll(".journal-entry-section")).toHaveLength(1)
    expect(screen.getByText(first.title)).toBeVisible()
    expect(screen.queryByText("synthetic local replacement")).toBeNull()
    expect(screen.queryByText(third.title)).toBeNull()
    expect(screen.queryByTestId("journal-manage-toggle")).toBeNull()
  })

  it("refreshes a direct detail from the current owner instead of retaining the previous owner's body", () => {
    setActiveLocalAccount("synthetic-reader-owner-a"); expect(saveEntry(first).ok).toBe(true)
    setActiveLocalAccount("synthetic-reader-owner-b"); expect(saveEntry(second).ok).toBe(true)
    setActiveLocalAccount("synthetic-reader-owner-a")
    render(<LogDetail date={DATE} />)
    expect(screen.getByText(first.title)).toBeVisible()
    act(() => { setActiveLocalAccount("synthetic-reader-owner-b") })
    expect(screen.queryByText(first.title)).toBeNull()
    expect(sectionForTitle(second.title)).toBeVisible()
  })

  it("does not reuse a supplied snapshot after its account scope changes", () => {
    setActiveLocalAccount("synthetic-reader-owner-a")
    const supplied = [first]
    const { rerender } = render(<LogDetail date={DATE} entries={supplied} readOnly />)
    expect(screen.getByText(first.title)).toBeVisible()
    act(() => { setActiveLocalAccount("synthetic-reader-owner-b") })
    expect(screen.queryByText(first.title)).toBeNull()
    expect(screen.queryByText("이 날의 일지는 아직 비어 있어요.")).toBeNull()
    rerender(<LogDetail date={DATE} entries={[second]} readOnly />)
    expect(sectionForTitle(second.title)).toBeVisible()
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
  })

  it("clears a deleted requested entry without opening the remaining same-day record as its replacement", () => {
    const { container, rerender } = render(<JournalDayReader date={DATE} entries={[first, second]}
      initialEntryId={second.id} onDateChange={vi.fn()} onBack={vi.fn()} />)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
    rerender(<JournalDayReader date={DATE} entries={[first]} initialEntryId={second.id}
      onDateChange={vi.fn()} onBack={vi.fn()} />)
    expect(container.querySelectorAll(".journal-entry-section")).toHaveLength(1)
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "false")
    expect(container.querySelector(".journal-entry-section[data-open='true']")).toBeNull()
  })

  it("retains supplied known records during an incomplete read without claiming an empty or complete result", () => {
    const { rerender } = render(<JournalDayReader date={DATE} entries={[first]} readComplete={false}
      onDateChange={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("기록을 아직 모두 확인하지 못했어요")
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "true")
    expect(screen.queryByText("이 날의 일지는 아직 비어 있어요.")).toBeNull()
    rerender(<JournalDayReader date={DATE} entries={[]} readComplete={false} onDateChange={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("기록이 없는 상태로 표시하지 않아요")
    expect(screen.queryByRole("button", { name: "첫 일지 쓰기" })).toBeNull()
    rerender(<JournalDayReader date={DATE} entries={[first]} readComplete onDateChange={vi.fn()} onBack={vi.fn()} />)
    expect(screen.queryByRole("status")).toBeNull()
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "true")
  })

  it("opens the requested target once on the first completed read, then respects a user's collapsed choice", () => {
    const props = { date: DATE, initialEntryId: second.id, onDateChange: vi.fn(), onBack: vi.fn() }
    const { rerender } = render(<JournalDayReader {...props} entries={[]} readComplete={false} />)
    rerender(<JournalDayReader {...props} entries={[first, second]} readComplete />)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "false")
    fireEvent.click(sectionForTitle(second.title).querySelector<HTMLButtonElement>(".journal-entry-summary")!)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
    rerender(<JournalDayReader {...props} entries={[first, second, third]} readComplete />)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
    expect(sectionForTitle(third.title)).toHaveAttribute("data-open", "false")
  })

  it("opens a single journal once on the first completed read without auto-opening a later addition", () => {
    const props = { date: DATE, onDateChange: vi.fn(), onBack: vi.fn() }
    const { rerender } = render(<JournalDayReader {...props} entries={[]} readComplete={false} />)
    rerender(<JournalDayReader {...props} entries={[first]} readComplete />)
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "true")
    rerender(<JournalDayReader {...props} entries={[first, second]} readComplete />)
    expect(sectionForTitle(first.title)).toHaveAttribute("data-open", "true")
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
  })

  it.each(["requested", "single"])("waits for a completed read when a %s record arrives in a partial snapshot", mode => {
    const target = mode === "requested" ? second : first
    const partial = mode === "requested" ? [first, second] : [first]
    const props = { date: DATE, ...(mode === "requested" ? { initialEntryId: second.id } : {}), onDateChange: vi.fn(), onBack: vi.fn() }
    const { rerender } = render(<JournalDayReader {...props} entries={[]} readComplete={false} />)
    rerender(<JournalDayReader {...props} entries={partial} readComplete={false} />)
    expect(sectionForTitle(target.title)).toHaveAttribute("data-open", "false")
    rerender(<JournalDayReader {...props} entries={partial} readComplete />)
    expect(sectionForTitle(target.title)).toHaveAttribute("data-open", "true")
    rerender(<JournalDayReader {...props} entries={[first, second, third]} readComplete />)
    fireEvent.click(sectionForTitle(target.title).querySelector<HTMLButtonElement>(".journal-entry-summary")!)
    rerender(<JournalDayReader {...props} entries={[first, second]} readComplete />)
    expect(sectionForTitle(target.title)).toHaveAttribute("data-open", "false")
  })

  it("does not reopen an initially available partial target that the user has already collapsed", () => {
    const props = { date: DATE, initialEntryId: second.id, onDateChange: vi.fn(), onBack: vi.fn() }
    const { rerender } = render(<JournalDayReader {...props} entries={[first, second]} readComplete={false} />)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
    fireEvent.click(sectionForTitle(second.title).querySelector<HTMLButtonElement>(".journal-entry-summary")!)
    rerender(<JournalDayReader {...props} entries={[first, second, third]} readComplete />)
    expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
  })

  it("keeps a user's individual or all-record collapse of a late partial target when the first read completes", () => {
    const props = { date: DATE, initialEntryId: second.id, onDateChange: vi.fn(), onBack: vi.fn() }
    for (const control of ["individual", "all"]) {
      const { rerender, unmount } = render(<JournalDayReader {...props} entries={[]} readComplete={false} />)
      rerender(<JournalDayReader {...props} entries={[first, second]} readComplete={false} />)
      expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
      if (control === "individual") {
        const toggle = sectionForTitle(second.title).querySelector<HTMLButtonElement>(".journal-entry-summary")!
        fireEvent.click(toggle)
        expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
        fireEvent.click(toggle)
      } else {
        fireEvent.click(screen.getByRole("button", { name: "모두 펼쳐보기" }))
        expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "true")
        fireEvent.click(screen.getByRole("button", { name: "간단히 보기" }))
      }
      rerender(<JournalDayReader {...props} entries={[first, second, third]} readComplete />)
      expect(sectionForTitle(second.title)).toHaveAttribute("data-open", "false")
      expect(sectionForTitle(third.title)).toHaveAttribute("data-open", "false")
      unmount()
    }
  })

  it("shows an incomplete read instead of an empty journal and restores its open entry after recovery", () => {
    expect(saveEntry(first).ok).toBe(true)
    const original = localStorage.getItem(JOURNAL_STORAGE_KEY)
    const { container } = render(<LogDetail date={DATE} />)
    const read = Storage.prototype.getItem
    let unavailable = true
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
      if (key === JOURNAL_STORAGE_KEY && unavailable) throw new Error("synthetic temporary journal read failure")
      return read.call(this, key)
    })
    act(() => { window.dispatchEvent(new Event("storage")) })
    expect(screen.getByRole("status")).toHaveTextContent("기록을 아직 모두 확인하지 못했어요")
    expect(screen.queryByText("이 날의 일지는 아직 비어 있어요.")).toBeNull()
    expect(screen.queryByRole("button", { name: "첫 일지 쓰기" })).toBeNull()
    unavailable = false
    act(() => { window.dispatchEvent(new Event("focus")) })
    expect(screen.getByText(first.title)).toBeVisible()
    expect(container.querySelector(".journal-entry-section")).toHaveAttribute("data-open", "true")
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
  })
})
