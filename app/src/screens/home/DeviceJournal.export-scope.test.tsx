import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { SafeJournalExport } from "./DeviceJournal"
import { BackupJsonExportLimitError, loadEntriesWithPrivateMemos, exportEntriesJSON } from "../../domain/journal-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { refreshAccountJournalRecordsForExport } from "../../domain/account/account-journal-record-service"
import { refreshAccountDecorationsForExport } from "../../domain/account/account-decoration-service"
import {
  accountCalendarDecorationExportReady,
  refreshAccountCalendarDecorationsForExport,
} from "../../domain/account/account-calendar-decoration-service"

vi.mock("../../domain/journal-store", async original => ({
  ...await original<typeof import("../../domain/journal-store")>(),
  loadEntriesWithPrivateMemos: vi.fn(),
  exportEntriesJSON: vi.fn(() => "{}"),
  safeExportSummary: () => ({ total: 0, included: 0, skipped: 0 }),
}))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  refreshAccountJournalRecordsForExport: vi.fn(async () => true),
}))
vi.mock("../../domain/account/account-decoration-service", () => ({
  refreshAccountDecorationsForExport: vi.fn(async () => true),
}))
vi.mock("../../domain/account/account-calendar-decoration-service", () => ({
  accountCalendarDecorationExportReady: vi.fn(() => true),
  refreshAccountCalendarDecorationsForExport: vi.fn(async () => true),
}))

const createUrl = vi.fn(() => "blob:synthetic-export")
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadEntriesWithPrivateMemos).mockReset().mockResolvedValue([])
  vi.mocked(refreshAccountJournalRecordsForExport).mockReset().mockResolvedValue(true)
  vi.mocked(refreshAccountDecorationsForExport).mockReset().mockResolvedValue(true)
  vi.mocked(refreshAccountCalendarDecorationsForExport).mockReset().mockResolvedValue(true)
  vi.mocked(accountCalendarDecorationExportReady).mockReset().mockReturnValue(true)
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
  expect(refreshAccountDecorationsForExport).toHaveBeenCalledOnce()
  expect(refreshAccountCalendarDecorationsForExport).toHaveBeenCalledOnce()
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
  vi.mocked(refreshAccountJournalRecordsForExport).mockImplementation(async () => { order.push("journals"); return true })
  vi.mocked(refreshAccountDecorationsForExport).mockImplementation(async () => { order.push("decorations"); return true })
  vi.mocked(refreshAccountCalendarDecorationsForExport).mockImplementation(async () => { order.push("calendar"); return true })
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
  expect(refreshAccountDecorationsForExport).toHaveBeenCalledTimes(mode === "full" ? 2 : 0)
  expect(refreshAccountCalendarDecorationsForExport).toHaveBeenCalledTimes(mode === "full" ? 2 : 0)
  expect(exportEntriesJSON).toHaveBeenCalledTimes(2)
  expect(order).toEqual(mode === "full"
    ? ["journals", "decorations", "calendar", "private", "export", "journals", "decorations", "calendar", "private", "export"]
    : ["journals", "export", "journals", "export"])
})

it.each(["decorations", "calendar"] as const)("fails a full backup closed when fresh %s cannot be confirmed", async kind => {
  if (kind === "decorations") vi.mocked(refreshAccountDecorationsForExport).mockResolvedValueOnce(false)
  else vi.mocked(refreshAccountCalendarDecorationsForExport).mockResolvedValueOnce(false)
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  await act(async () => {})

  expect(exportEntriesJSON).not.toHaveBeenCalled()
  expect(createUrl).not.toHaveBeenCalled()
  expect(loadEntriesWithPrivateMemos).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining(kind === "decorations" ? "꾸미기 자료" : "달력 꾸미기 자료"))
})

it("retries the decoration-calendar pair once when the first fresh pair is not ownership-consistent", async () => {
  vi.mocked(accountCalendarDecorationExportReady)
    .mockReturnValueOnce(false)
    .mockReturnValue(true)
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  await act(async () => {})

  expect(refreshAccountDecorationsForExport).toHaveBeenCalledTimes(2)
  expect(refreshAccountCalendarDecorationsForExport).toHaveBeenCalledTimes(2)
  expect(accountCalendarDecorationExportReady).toHaveBeenCalledTimes(3)
  expect(loadEntriesWithPrivateMemos).toHaveBeenCalledOnce()
  expect(exportEntriesJSON).toHaveBeenCalledOnce()
})

it("fails closed after one retry when fresh decoration-calendar pairs remain inconsistent", async () => {
  vi.mocked(accountCalendarDecorationExportReady).mockReturnValue(false)
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  await act(async () => {})

  expect(refreshAccountDecorationsForExport).toHaveBeenCalledTimes(2)
  expect(refreshAccountCalendarDecorationsForExport).toHaveBeenCalledTimes(2)
  expect(accountCalendarDecorationExportReady).toHaveBeenCalledTimes(2)
  expect(loadEntriesWithPrivateMemos).not.toHaveBeenCalled()
  expect(exportEntriesJSON).not.toHaveBeenCalled()
  expect(createUrl).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining("달력 꾸미기 자료"))
})

it("fails closed if the validated pair becomes inconsistent while private memos are loading", async () => {
  vi.mocked(accountCalendarDecorationExportReady)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false)
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)
  fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
  fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  await act(async () => {})

  expect(refreshAccountDecorationsForExport).toHaveBeenCalledOnce()
  expect(refreshAccountCalendarDecorationsForExport).toHaveBeenCalledOnce()
  expect(loadEntriesWithPrivateMemos).toHaveBeenCalledOnce()
  expect(exportEntriesJSON).not.toHaveBeenCalled()
  expect(createUrl).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining("달력 꾸미기 자료"))
})

it.each(["safe", "full"] as const)("explains when a %s export exceeds the matching import budget", async mode => {
  vi.mocked(exportEntriesJSON).mockImplementationOnce(() => {
    throw new BackupJsonExportLimitError("blobBytes")
  })
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {})
  render(<SafeJournalExport />)

  if (mode === "full") {
    fireEvent.click(screen.getByRole("button", { name: "메모 포함 파일 내보내기 (JSON)" }))
    fireEvent.click(screen.getByRole("button", { name: "파일 만들기" }))
  } else {
    fireEvent.click(screen.getByRole("button", { name: "내 일지 데이터 내려받기 (JSON)" }))
  }
  await act(async () => {})

  expect(createUrl).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining("한 파일로 만들 수 있는 크기"))
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
