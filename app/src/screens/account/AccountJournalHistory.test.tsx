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
  restoreAccountJournalVersion: (...args: unknown[]) => mocks.restore(...args),
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
  mocks.restore.mockResolvedValue(true)
  render(<AccountJournalHistory entryId="entry" />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "수정 이력 · 30일" })))
  expect(screen.getByText(/거리 4km/).textContent).toContain("RPE 미기록")
  fireEvent.click(screen.getByText(/수정본 1/))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "이 내용으로 되돌리기" })))
  expect(mocks.restore).toHaveBeenCalledWith("doc", 1, 2)
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
