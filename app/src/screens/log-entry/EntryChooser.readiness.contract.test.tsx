import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-schema"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"
import { setAccountAuthState } from "../../domain/account/account-auth-state"
import { EntryChooser } from "./EntryChooser"

vi.mock("../../domain/account/config", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/config")>(),
  accountFeatureEnabled: () => true,
}))

const STORAGE_KEY = "trainoracle.journal.v1"
const DATE = "2026-10-12"
const ENTRY = {
  id: "synthetic-chooser-entry", kind: "post-session", date: "2026-10-11", savedAt: "2026-10-11T01:00:00Z",
  syncState: "local", system: "base", title: "", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3, memo: "",
} satisfies JournalEntry
const guide = () => document.querySelector('img[src$="mari-journal-guide.webp"]')

beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null); setAccountAuthState("GUEST")
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers()
  setActiveLocalAccount(null); resetAccountJournalProjection(null); setAccountAuthState("RESOLVING"); localStorage.clear()
})

describe("entry chooser confirmed-first journal guard", () => {
  it("offers the first-journal guide only after a confirmed empty read and keeps all entry destinations", () => {
    const pick = vi.fn(), openImport = vi.fn()
    render(<EntryChooser targetDate={DATE} onPick={pick} onOpenImport={openImport} />)
    expect(screen.getByText(/오늘 첫 일지예요/)).toBeVisible()
    expect(guide()).not.toBeNull()
    for (const type of ["quick-session", "post-session", "evening", "race"]) {
      fireEvent.click(screen.getByTestId(`entry-choice-${type}`))
      expect(pick).toHaveBeenLastCalledWith(type)
    }
    fireEvent.click(screen.getByTestId("open-import"))
    expect(openImport).toHaveBeenCalledOnce()
  })

  it.each(["malformed", "read-failure"] as const)("does not present %s local storage as the first journal", failure => {
    if (failure === "malformed") localStorage.setItem(STORAGE_KEY, "{")
    else {
      const read = Storage.prototype.getItem
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
        if (key === STORAGE_KEY) throw new Error("synthetic unreadable journal")
        return read.call(this, key)
      })
    }
    const pick = vi.fn()
    render(<EntryChooser targetDate={DATE} onPick={pick} />)
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 읽지 못했어요")
    expect(screen.queryByText(/첫 일지예요/)).toBeNull()
    expect(guide()).toBeNull()
    fireEvent.click(screen.getByTestId("entry-choice-quick-session"))
    expect(pick).toHaveBeenCalledWith("quick-session")
  })

  it("does not call an unconfirmed target date empty when another valid entry survives a partial local read", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ENTRY, { kind: "synthetic-invalid" }]))
    render(<EntryChooser targetDate={DATE} />)
    expect(screen.getByRole("status")).toHaveTextContent("기록의 최신 상태를 확인하지 못했어요")
    expect(screen.queryByText(/첫 일지예요/)).toBeNull()
    expect(guide()).toBeNull()
  })

  it("keeps LOADING distinct from first and refreshes only when the existing snapshot becomes READY", () => {
    const owner = "synthetic-chooser-owner"
    setActiveLocalAccount(owner); resetAccountJournalProjection(owner)
    const pick = vi.fn(), openImport = vi.fn()
    render(<EntryChooser targetDate={DATE} onPick={pick} onOpenImport={openImport} />)
    expect(screen.getByRole("status")).toHaveTextContent("기록을 확인하고 있어요")
    expect(screen.queryByText(/첫 일지예요/)).toBeNull()
    expect(guide()).toBeNull()
    fireEvent.click(screen.getByTestId("entry-choice-evening"))
    fireEvent.click(screen.getByTestId("open-import"))
    expect(pick).toHaveBeenCalledWith("evening")
    expect(openImport).toHaveBeenCalledOnce()
    act(() => { setAccountJournalProjectionStatus(owner, "READY") })
    expect(screen.getByText(/오늘 첫 일지예요/)).toBeVisible()
    expect(guide()).not.toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("counts a visible existing journal without repeating a first-journal guide", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...ENTRY, date: DATE }]))
    render(<EntryChooser targetDate={DATE} />)
    expect(screen.queryByText(/첫 일지예요/)).toBeNull()
    expect(guide()).toBeNull()
    expect(screen.getByText(/일지 1개/)).toBeVisible()
  })
})
