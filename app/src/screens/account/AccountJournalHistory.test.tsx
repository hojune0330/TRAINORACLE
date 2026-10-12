import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ owner: "A", changed: () => {}, history: vi.fn(), restore: vi.fn() }))
vi.mock("../../domain/account/local-journal-ownership", () => ({
  activeLocalAccount: () => mocks.owner,
  onLocalJournalScopeChange: (callback: () => void) => { mocks.changed = callback; return () => {} },
}))
vi.mock("../../domain/account/account-journal-projection", () => ({ readAccountJournalPrivateEntry: () => ({ id: "entry" }) }))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true,
  accountJournalDeletedDocuments: () => [{ documentId: "doc", revision: 2 }],
  readAccountJournalRecordVersion: async () => ({ documentId: "doc", revision: 2 }),
  accountJournalRecordHistory: (...args: unknown[]) => mocks.history(...args),
  restoreAccountJournalVersionResult: (...args: unknown[]) => mocks.restore(...args),
}))
import { AccountJournalHistory } from "./AccountJournalHistory"

const historical = () => ({ kind: "history", documentId: "doc", versions: [{ revision: 1,
  document: { entry: { id: "entry", kind: "post-session", date: "2026-09-08", title: "시험 훈련",
    distanceKm: "4", durationMin: "25", rpe: 0, memo: "synthetic-private-history", memoPurpose: "PRIVATE_SELF_ONLY" } },
  replacedAt: "2026-09-08T00:00:00Z", expiresAt: "2026-10-08T00:00:00Z", reason: "replaced" }] })
beforeEach(() => { mocks.owner = "A"; mocks.history.mockReset(); mocks.restore.mockReset() })
afterEach(cleanup)

it("shows the actual revision and missing RPE, restoring the selected source revision", async () => {
  mocks.history.mockResolvedValue(historical())
  mocks.restore.mockResolvedValue({ ok: true })
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  expect(screen.getByText(/거리 4km/).textContent).toContain("RPE 미기록")
  fireEvent.click(screen.getByText(/수정본 1/))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" })))
  expect(mocks.restore).toHaveBeenCalledWith("doc", 1, 2)
  expect(screen.queryByText("synthetic-private-history")).toBeNull()
  expect(screen.getByRole("status").textContent).toContain("이전 내용으로 되돌렸어요")
})

it("explains an unavailable restore source and disables only that version without retrying", async () => {
  mocks.history.mockResolvedValue(historical())
  mocks.restore.mockResolvedValue({ ok: false, code: "SOURCE_UNAVAILABLE" })
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" })))
  expect(screen.getByRole("status").textContent).toContain("복원 원본이 없어")
  expect(screen.getByRole("status").textContent).not.toContain("다른 기기")
  expect(screen.getByRole("button", { name: "이 내용으로 되돌리기" })).toBeDisabled()
  expect(screen.getByText("synthetic-private-history")).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" }))
  expect(mocks.restore).toHaveBeenCalledTimes(1)
})

it.each([
  ["REMOTE_CHANGED", "다른 기기에서 일지가 바뀌었어요"],
  ["CONFLICT", "복원 요청이 다른 작업과 겹쳤어요"],
])("requires a fresh review for %s without blaming expiry", async (code, text) => {
  mocks.history.mockResolvedValue(historical())
  mocks.restore.mockResolvedValue({ ok: false, code })
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" })))
  expect(screen.getByRole("status").textContent).toContain(text)
  expect(screen.getByRole("status").textContent).not.toContain("보관 기간")
  expect(screen.getByRole("button", { name: "이 내용으로 되돌리기" })).toBeDisabled()
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  expect(screen.getByRole("button", { name: "이 내용으로 되돌리기" })).toBeEnabled()
  expect(mocks.restore).toHaveBeenCalledTimes(1)
})

it("keeps an uncertain network result retryable without claiming failed mutation or expiry", async () => {
  mocks.history.mockResolvedValue(historical())
  mocks.restore.mockResolvedValue({ ok: false, code: "FAILED" })
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" })))
  expect(screen.getByRole("status").textContent).toContain("복원 결과를 확인하지 못했어요")
  expect(screen.getByRole("status").textContent).not.toContain("보관 기간")
  expect(screen.getByRole("button", { name: "이 내용으로 되돌리기" })).toBeEnabled()
})

it("rejects a late restore result after an A-B-A scope transition", async () => {
  mocks.history.mockResolvedValue(historical())
  let resolve!: (value: unknown) => void
  mocks.restore.mockImplementation(() => new Promise(done => { resolve = done }))
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" }))
  act(() => { mocks.owner = "B"; mocks.changed(); mocks.owner = "A"; mocks.changed() })
  await act(async () => resolve({ ok: false, code: "SOURCE_UNAVAILABLE" }))
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.queryByText("synthetic-private-history")).toBeNull()
})

it("clears loaded private history on account switch", async () => {
  mocks.history.mockResolvedValue(historical())
  render(<AccountJournalHistory />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "계정 휴지통 · 30일" })))
  expect(screen.getByText("synthetic-private-history")).toBeTruthy()
  act(() => { mocks.owner = "B"; mocks.changed() })
  expect(screen.queryByText("synthetic-private-history")).toBeNull()
})

it("rejects a delayed history response after an A-B-A account transition", async () => {
  let resolve!: (value: unknown) => void
  mocks.history.mockImplementation(() => new Promise(done => { resolve = done }))
  render(<AccountJournalHistory />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "계정 휴지통 · 30일" })))
  act(() => { mocks.owner = "B"; mocks.changed(); mocks.owner = "A"; mocks.changed() })
  await act(async () => resolve(historical()))
  expect(screen.queryByText("synthetic-private-history")).toBeNull()
})
