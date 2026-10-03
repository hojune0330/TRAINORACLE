import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { SafeJournalExport } from "./DeviceJournal"
import { loadEntriesWithPrivateMemos, exportEntriesJSON } from "../../domain/journal-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { refreshAccountJournalRecordsForExport } from "../../domain/account/account-journal-record-service"

vi.mock("../../domain/journal-store", async original => ({
  ...await original<typeof import("../../domain/journal-store")>(),
  loadEntriesWithPrivateMemos: vi.fn(),
  exportEntriesJSON: vi.fn(() => "{}"),
  safeExportSummary: () => ({ total: 0, included: 0, skipped: 0 }),
}))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  refreshAccountJournalRecordsForExport: vi.fn(async () => true),
}))

const createUrl = vi.fn(() => "blob:synthetic-export")
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadEntriesWithPrivateMemos).mockReset().mockResolvedValue([])
  vi.mocked(refreshAccountJournalRecordsForExport).mockReset().mockResolvedValue(true)
  vi.mocked(exportEntriesJSON).mockReset().mockReturnValue("{}")
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
  await vi.waitFor(() => expect(loadEntriesWithPrivateMemos).toHaveBeenCalledOnce())
  await act(async () => {
    if (mode !== "stable") setActiveLocalAccount(mode === "logout" ? null : "B")
    if (mode === "ABA") setActiveLocalAccount("A")
    finish()
  })
  expect(exportEntriesJSON).toHaveBeenCalledTimes(mode === "stable" ? 1 : 0)
  expect(createUrl).toHaveBeenCalledTimes(mode === "stable" ? 1 : 0)
  expect(refreshAccountJournalRecordsForExport).toHaveBeenCalledOnce()
})

it("revokes an open full-export confirmation on an account switch", () => {
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  act(() => { setActiveLocalAccount("B"); setActiveLocalAccount("A") })
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(loadEntriesWithPrivateMemos).not.toHaveBeenCalled()
})

it.each(["safe", "full"] as const)("explains why %s export cannot create a file before journals are ready", async mode => {
  vi.mocked(exportEntriesJSON).mockImplementationOnce(() => { throw new Error("JOURNAL_BACKUP_NOT_READY") })
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)
  if (mode === "safe") {
    fireEvent.click(screen.getByRole("button", { name: "내 일지 데이터 내려받기 (JSON)" }))
  } else {
    fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
    fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  }
  await act(async () => {})
  expect(createUrl).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining("계정 내용 확인"))
})

it.each(["safe", "full"] as const)("requires a fresh account list for every %s export click", async mode => {
  const order: string[] = []
  vi.mocked(loadEntriesWithPrivateMemos).mockImplementation(async () => { order.push("private"); return [] })
  vi.mocked(refreshAccountJournalRecordsForExport).mockImplementation(async () => { order.push("fresh"); return true })
  vi.mocked(exportEntriesJSON).mockImplementation(() => { order.push("export"); return "{}" })
  render(<SafeJournalExport />)

  const clickExport = () => {
    if (mode === "safe") fireEvent.click(screen.getByRole("button", { name: "내 일지 데이터 내려받기 (JSON)" }))
    else {
      fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
      fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
    }
  }
  clickExport()
  await act(async () => {})
  clickExport()
  await act(async () => {})

  expect(refreshAccountJournalRecordsForExport).toHaveBeenCalledTimes(2)
  expect(exportEntriesJSON).toHaveBeenCalledTimes(2)
  expect(order).toEqual(mode === "full"
    ? ["fresh", "private", "export", "fresh", "private", "export"]
    : ["fresh", "export", "fresh", "export"])
})

it.each(["safe", "full"] as const)("fails closed when the fresh %s export list cannot be confirmed", async mode => {
  vi.mocked(refreshAccountJournalRecordsForExport).mockResolvedValueOnce(false)
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)
  if (mode === "safe") fireEvent.click(screen.getByRole("button", { name: "내 일지 데이터 내려받기 (JSON)" }))
  else {
    fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
    fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  }
  await act(async () => {})

  expect(exportEntriesJSON).not.toHaveBeenCalled()
  expect(createUrl).not.toHaveBeenCalled()
  expect(loadEntriesWithPrivateMemos).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining("일지 전체를 확인할 수 없어"))
})

it.each(["safe", "full"] as const)("revokes a pending fresh %s export after an ABA account switch", async mode => {
  let finish!: () => void
  vi.mocked(refreshAccountJournalRecordsForExport).mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve(true)
  }))
  render(<SafeJournalExport />)
  if (mode === "safe") fireEvent.click(screen.getByRole("button", { name: "내 일지 데이터 내려받기 (JSON)" }))
  else {
    fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
    fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  }
  await vi.waitFor(() => expect(refreshAccountJournalRecordsForExport).toHaveBeenCalledOnce())
  await act(async () => { setActiveLocalAccount("B"); setActiveLocalAccount("A"); finish() })

  expect(exportEntriesJSON).not.toHaveBeenCalled()
  expect(createUrl).not.toHaveBeenCalled()
})
