import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { SafeJournalExport } from "./DeviceJournal"
import { loadEntriesWithPrivateMemos, exportEntriesJSON } from "../../domain/journal-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

vi.mock("../../domain/journal-store", async original => ({
  ...await original<typeof import("../../domain/journal-store")>(),
  loadEntriesWithPrivateMemos: vi.fn(),
  exportEntriesJSON: vi.fn(() => "{}"),
  safeExportSummary: () => ({ total: 0, included: 0, skipped: 0 }),
}))

const createUrl = vi.fn(() => "blob:synthetic-export")
beforeEach(() => {
  vi.clearAllMocks()
  setActiveLocalAccount("A")
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createUrl
    static revokeObjectURL = vi.fn()
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each(["B", "logout", "ABA", "stable"])("checks export authority after private hydration: %s", async mode => {
  let finish!: () => void
  vi.mocked(loadEntriesWithPrivateMemos).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve([]) }))
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  expect(loadEntriesWithPrivateMemos).toHaveBeenCalledOnce()
  await act(async () => {
    if (mode !== "stable") setActiveLocalAccount(mode === "logout" ? null : "B")
    if (mode === "ABA") setActiveLocalAccount("A")
    finish()
  })
  expect(exportEntriesJSON).toHaveBeenCalledTimes(mode === "stable" ? 1 : 0)
  expect(createUrl).toHaveBeenCalledTimes(mode === "stable" ? 1 : 0)
})

it("revokes an open full-export confirmation on an account switch", () => {
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(loadEntriesWithPrivateMemos).not.toHaveBeenCalled()
})
