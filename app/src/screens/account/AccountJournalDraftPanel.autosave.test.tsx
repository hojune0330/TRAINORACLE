import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountJournalDraft, AccountJournalDraftView } from "../../domain/account/account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "../../domain/account/account-journal-api"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"

const mocks = vi.hoisted(() => ({
  owner: "11111111-1111-4111-8111-111111111111",
  rows: new Map<string, AccountJournalDraftView>(),
  request: vi.fn(), save: vi.fn(), ack: vi.fn(),
}))
vi.mock("../../domain/account/local-journal-ownership", () => ({
  activeLocalAccount: () => mocks.owner, onLocalJournalScopeChange: () => () => {},
}))
vi.mock("../../domain/account/account-journal-api", () => ({ requestAccountJournal: (...args: unknown[]) => mocks.request(...args) }))
vi.mock("../../domain/account/account-journal-draft-buffer", () => ({ createAccountJournalDraftBuffer: () => ({
  list: async () => structuredClone([...mocks.rows.values()]),
  read: async (_owner: string, id: string) => structuredClone(mocks.rows.get(id) ?? null),
  saveDraft: (...args: unknown[]) => mocks.save(...args),
  queue: async (_owner: string, id: string, operationId: string) => {
    const row = mocks.rows.get(id)!
    row.pending = { operationId, expectedRevision: row.serverRevision, sequence: row.localSequence, draft: structuredClone(row.draft) }
    row.state = "PENDING"
  },
  ack: (...args: unknown[]) => mocks.ack(...args),
  conflict: async () => true, importRemote: async () => {}, logout: () => {}, close: () => {},
}) }))
import { AccountJournalDraftPanel } from "./AccountJournalDraftPanel"

const owner = "11111111-1111-4111-8111-111111111111"
const saved = (request: AccountJournalRequest): AccountJournalResult => {
  if (request.action !== "save") return { ok: true, data: { kind: "list", documents: [], nextCursor: null } }
  return { ok: true, data: { kind: "saved", documentId: request.documentId,
    operationId: request.operationId, revision: request.expectedRevision + 1 } }
}
async function settle() { await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }) }
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
async function editor() {
  const view = render(<AccountJournalDraftPanel userId={owner} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("button", { name: "새 초안" }))
  await settle()
  return view
}
function type(body: string) { fireEvent.change(screen.getByLabelText("내용"), { target: { value: body } }) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-08T00:00:00Z"))
  vi.clearAllMocks()
  mocks.owner = owner
  mocks.rows.clear()
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  mocks.save.mockImplementation(async (ownerId: string, id: string, draft: AccountJournalDraft, sequence: number) => {
    const old = mocks.rows.get(id)
    if ((old?.localSequence ?? 0) !== sequence) throw new Error("CAS mismatch")
    mocks.rows.set(id, { ownerId, documentId: id, serverRevision: 0, acknowledgedSequence: 0,
      pending: null, blocked: null, remoteDraft: null, ...old, draft: structuredClone(draft),
      localSequence: sequence + 1, state: old?.pending ? "PENDING" : "LOCAL_CHANGES" })
  })
  mocks.ack.mockImplementation(async (_owner: string, id: string, operationId: string, revision: number) => {
    const row = mocks.rows.get(id)!
    if (!row.pending || row.pending.operationId !== operationId || revision !== row.serverRevision + 1) return false
    row.acknowledgedSequence = row.pending.sequence
    row.serverRevision = revision
    row.pending = null
    row.state = row.acknowledgedSequence === row.localSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"
    return true
  })
  mocks.request.mockImplementation(async (_owner: string, request: AccountJournalRequest) => saved(request))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it("debounces rapid inputs for 800ms, preserves CAS revisions, and does not rewrite on explicit Save", async () => {
  await editor()
  type("first"); await settle(); await tick(799)
  type("latest"); await settle(); await tick(799)
  expect(mocks.request).not.toHaveBeenCalled()
  await tick(1)
  expect(mocks.request).toHaveBeenCalledTimes(1)
  expect(mocks.request.mock.calls[0]![1]).toMatchObject({ action: "save", expectedRevision: 0, document: { body: "latest" } })
  expect(mocks.save.mock.calls.map(call => call[3])).toEqual([0, 1, 2])
  expect(screen.getByRole("status")).toHaveTextContent("계정에 초안이 저장됐어요")
  fireEvent.click(screen.getByRole("button", { name: "계정에 저장" }))
  await settle()
  expect(mocks.save).toHaveBeenCalledTimes(3)
  expect(mocks.request).toHaveBeenCalledTimes(1)
})

it("keeps typing enabled during network IO and never labels newer volatile input saved", async () => {
  let finish!: (result: AccountJournalResult) => void
  mocks.request.mockImplementationOnce(() => new Promise<AccountJournalResult>(resolve => { finish = resolve }))
  await editor(); type("sent"); await settle(); await tick(800)
  expect(screen.getByLabelText("내용")).not.toBeDisabled()
  type("new input"); await settle()
  window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online"))
  await settle()
  expect(mocks.request).toHaveBeenCalledTimes(1)
  finish(saved(mocks.request.mock.calls[0]![1])); await settle()
  expect(screen.getByLabelText("내용")).toHaveValue("new input")
  expect(screen.getByRole("status")).not.toHaveTextContent("계정에 초안이 저장됐어요")
  await tick(800)
  expect(mocks.request).toHaveBeenCalledTimes(2)
  expect(mocks.request.mock.calls[1]![1]).toMatchObject({ expectedRevision: 1, document: { body: "new input" } })
  expect(screen.getByRole("status")).toHaveTextContent("계정에 초안이 저장됐어요")
})

it("retries an immutable pending operation online without concurrent requests", async () => {
  mocks.request.mockResolvedValueOnce({ ok: false, code: "UNAVAILABLE" })
  await editor(); type("retry"); await settle(); await tick(800)
  expect(screen.getByRole("status")).not.toHaveTextContent("계정에 초안이 저장됐어요")
  window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online"))
  await settle(); await tick(0)
  expect(mocks.request).toHaveBeenCalledTimes(2)
  expect(mocks.request.mock.calls[1]![1]).toEqual(mocks.request.mock.calls[0]![1])
})

it.each(["documentId", "operationId", "revision"])("rejects wrong receipt %s instead of reporting saved", async field => {
  mocks.request.mockImplementation(async (_owner: string, request: any) => ({ ok: true,
    data: { kind: "saved", documentId: request.documentId, operationId: request.operationId,
      revision: request.expectedRevision + 1, [field]: field === "revision" ? 99 : "wrong" } }))
  await editor(); type("unconfirmed"); await settle(); await tick(800)
  expect(mocks.ack).not.toHaveBeenCalled()
  expect(screen.getByRole("status")).not.toHaveTextContent("계정에 초안이 저장됐어요")
  expect(screen.getByLabelText("내용")).toHaveValue("unconfirmed")
})

it("isolates a stale account response after a prop change", async () => {
  let finish!: (result: AccountJournalResult) => void
  mocks.request.mockImplementationOnce(() => new Promise<AccountJournalResult>(resolve => { finish = resolve }))
  const view = await editor(); type("owner A"); await settle(); await tick(800)
  const request = mocks.request.mock.calls[0]![1]
  mocks.owner = "33333333-3333-4333-8333-333333333333"
  view.rerender(<AccountJournalDraftPanel userId={mocks.owner} />)
  finish(saved(request)); await settle()
  expect(mocks.ack).not.toHaveBeenCalled()
  expect(screen.queryByDisplayValue("owner A")).toBeNull()
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByRole("status")).not.toHaveTextContent("계정에 초안이 저장됐어요")
})

it("blocks internal navigation after local failure and releases only after successful recovery", async () => {
  await editor()
  mocks.save.mockRejectedValueOnce(new Error("local failure"))
  type("must survive"); await settle()
  const navigate = vi.fn()
  act(() => { expect(runDraftSafeNavigation(navigate)).toBe(false) })
  expect(navigate).not.toHaveBeenCalled()
  expect(screen.getByLabelText("내용")).toHaveValue("must survive")
  await tick(800)
  expect(mocks.request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "계정에 저장" }))
  await settle()
  expect(runDraftSafeNavigation(navigate)).toBe(true)
  expect(screen.getByLabelText("내용")).toHaveValue("must survive")
})

it("blocks navigation during a local write but allows a durable offline draft", async () => {
  await editor()
  const original = mocks.save.getMockImplementation()!
  let finish!: () => void
  mocks.save.mockImplementationOnce((...args: unknown[]) => new Promise<void>(resolve => {
    finish = () => { void original(...args).then(resolve) }
  }))
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  type("offline"); await settle()
  act(() => { expect(runDraftSafeNavigation(() => {})).toBe(false) })
  finish(); await settle(); await tick(800)
  expect(runDraftSafeNavigation(() => {})).toBe(true)
  expect(mocks.request).not.toHaveBeenCalled()
  expect(screen.getByRole("status")).toHaveTextContent("연결 대기")
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  window.dispatchEvent(new Event("online")); await settle()
  expect(mocks.request).toHaveBeenCalledOnce()
})
