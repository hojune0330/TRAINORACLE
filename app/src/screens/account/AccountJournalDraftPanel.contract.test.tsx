import React from "react"
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ owner: "11111111-1111-4111-8111-111111111111", items: [] as any[], request: vi.fn(), save: vi.fn(), close: vi.fn() }))
vi.mock("../../domain/account/local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner, onLocalJournalScopeChange: () => () => {} }))
vi.mock("../../domain/account/account-journal-api", () => ({ requestAccountJournal: (...args: unknown[]) => mocks.request(...args) }))
vi.mock("../../domain/account/account-journal-draft-buffer", () => ({ createAccountJournalDraftBuffer: () => ({
  list: async () => mocks.items,
  read: async (_owner: string, id: string) => mocks.items.find(item => item.documentId === id),
  saveDraft: (...args: unknown[]) => mocks.save(...args),
  importRemote: async (_owner: string, id: string, draft: unknown, revision: number) => {
    mocks.items = [{ ...mocks.items[0], documentId: id, draft, serverRevision: revision, localSequence: 2 }]
  }, close: mocks.close, logout: vi.fn(),
}) }))
import { AccountJournalDraftPanel } from "./AccountJournalDraftPanel"

const documentId = "22222222-2222-4222-8222-222222222222"
const document = { version: 1, state: "DRAFT", visibility: "PRIVATE", date: "2026-09-08", title: "초안", body: "이전 내용" }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.items = [{ documentId, draft: document, localSequence: 1, acknowledgedSequence: 1,
    serverRevision: 1, state: "DRAFT_ACKNOWLEDGED", pending: null, blocked: null }]
  mocks.save.mockResolvedValue(undefined)
  mocks.request.mockResolvedValue({ ok: true, data: { kind: "list", documents: [], nextCursor: null } })
})
afterEach(cleanup)

it("does not send private data before the explicit storage choice", () => {
  render(<AccountJournalDraftPanel userId={mocks.owner} />)
  expect(mocks.request).not.toHaveBeenCalled()
  expect(screen.queryByRole("textbox")).toBeNull()
})

it("refresh replaces clean editor content and its local CAS sequence together", async () => {
  render(<AccountJournalDraftPanel userId={mocks.owner} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("button", { name: "계정 초안 불러오기" }))
  fireEvent.click(await screen.findByRole("button", { name: "2026-09-08 · 초안" }))
  await screen.findByDisplayValue("이전 내용")
  mocks.request.mockResolvedValue({ ok: true, data: { kind: "list", documents: [
    { documentId, revision: 2, document: { ...document, body: "다른 기기의 최신 내용" } },
  ], nextCursor: null } })
  fireEvent.click(screen.getByRole("button", { name: "계정 초안 불러오기" }))
  await screen.findByDisplayValue("다른 기기의 최신 내용")
  fireEvent.change(screen.getByLabelText("내용"), { target: { value: "최신 내용에 추가" } })
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(mocks.owner, documentId,
    expect.objectContaining({ body: "최신 내용에 추가" }), 2))
})

it("keeps the local list and reports a failed server list rather than empty success", async () => {
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  render(<AccountJournalDraftPanel userId={mocks.owner} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("button", { name: "계정 초안 불러오기" }))
  expect(await screen.findByRole("button", { name: "2026-09-08 · 초안" })).toBeTruthy()
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("모두 불러오지 못했어요"))
})

it("waits for queued local input before closing its buffer on navigation", async () => {
  let finish!: () => void
  mocks.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const view = render(<AccountJournalDraftPanel userId={mocks.owner} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("button", { name: "새 초안" }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalled())
  view.unmount()
  expect(mocks.close).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce())
})
