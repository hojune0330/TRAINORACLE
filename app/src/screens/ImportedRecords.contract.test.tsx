import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { ImportedRecords } from "./ImportedRecords"
import { toImportedEntry } from "../domain/import/import-draft"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { markCurrentConfirmedAccountJournalProjection, resetAccountJournalProjection } from "../domain/account/account-journal-projection"

afterEach(() => { cleanup(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })
const entry = (id: string, date: string, distanceKm: string) => ({ ...toImportedEntry({ date, name: "같은 운동", sport: "running", distanceKm, durationMin: "15", avgPace: "" }, "tcx"), id })

it("lists every actual imported journal and opens an exact same-day or different-day identity without writing", async () => {
  const open = vi.fn(), user = userEvent.setup(), write = vi.spyOn(Storage.prototype, "setItem")
  const entries = [entry("a", "2026-10-16", "2"), entry("b", "2026-10-16", "3"), entry("c", "2026-10-15", "4")]
  render(<ImportedRecords entries={entries} readComplete onOpenEntry={open} onBack={vi.fn()} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(3)
  await user.click(screen.getByRole("button", { name: /3km.*15분/u }))
  expect(open).toHaveBeenLastCalledWith("2026-10-16", "b")
  await user.click(screen.getByRole("button", { name: /4km.*15분/u }))
  expect(open).toHaveBeenLastCalledWith("2026-10-15", "c")
  expect(write).not.toHaveBeenCalled()
  write.mockRestore()
})

it("does not substitute another record for an unavailable exact destination or label an incomplete read empty", () => {
  const props = { entries: [entry("a", "2026-10-16", "2")], onOpenEntry: vi.fn(), onBack: vi.fn() }
  const view = render(<ImportedRecords {...props} readComplete selected={{ date: "2026-10-16", id: "missing" }} />)
  expect(screen.getByRole("alert")).toHaveTextContent("선택한 일지를 찾지 못했어요")
  expect(screen.queryByText("2km")).toBeNull()
  view.rerender(<ImportedRecords {...props} entries={[]} readComplete={false} />)
  expect(screen.getByRole("heading", { name: "기록 확인 중" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "가져온 기록이 없어요" })).toBeNull()
  view.rerender(<ImportedRecords {...props} entries={[]} readComplete={false} readUnavailable />)
  expect(screen.getByRole("heading", { name: "기록을 모두 확인하지 못했어요" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "기록 확인 중" })).toBeNull()
})

it("requires an exact current account acknowledgement and never promotes pending copies", () => {
  setActiveLocalAccount("A"); resetAccountJournalProjection("A")
  const confirmed = entry("ack", "2026-10-16", "2"), pending = entry("pending", "2026-10-16", "3")
  markCurrentConfirmedAccountJournalProjection("A", confirmed, 1)
  const props = { entries: [confirmed, pending], readComplete: false, onOpenEntry: vi.fn(), onBack: vi.fn() }
  const view = render(<ImportedRecords {...props} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(1)
  expect(screen.queryByRole("button", { name: /3km/u })).toBeNull()
  setActiveLocalAccount("B")
  view.rerender(<ImportedRecords {...props} />)
  expect(screen.queryByRole("listitem")).toBeNull()
  expect(screen.queryByRole("heading", { name: "가져온 기록이 없어요" })).toBeNull()
})
