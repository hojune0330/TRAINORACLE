import { beforeEach, expect, it, vi } from "vitest"
import { flushAccountJournalDraft } from "./account-journal-sync"
import { closeAccountDeletionBoundary } from "./account-deletion-boundary"
import type { AccountJournalDraft, AccountJournalDraftBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { AccountJournalResult } from "./account-journal-api"

const doc = "22222222-2222-4222-8222-222222222222"
const operationId = "33333333-3333-4333-8333-333333333333"
const draft: AccountJournalDraft = { version: 1, state: "DRAFT", visibility: "PRIVATE", date: "2026-10-07", title: "", body: "synthetic retained draft" }
const instant = "2026-10-07T00:00:00.000Z"
beforeEach(() => localStorage.clear())
function fixture(ownerId: string) {
  const view: AccountJournalDraftView = { ownerId, documentId: doc, serverRevision: 0, localSequence: 1,
    acknowledgedSequence: 0, state: "PENDING", draft, blocked: null, remoteDraft: null,
    pending: { operationId, expectedRevision: 0, sequence: 1, draft } }
  const read = vi.fn().mockResolvedValue(view), ack = vi.fn().mockResolvedValue(true)
  const buffer = { read, ack, queue: vi.fn(), clear: vi.fn(), conflict: vi.fn(), reject: vi.fn() } as unknown as AccountJournalDraftBuffer
  const result: AccountJournalResult<AccountJournalDraft> = { ok: true, data: { kind: "saved", documentId: doc, operationId, revision: 1 } }
  return { view, buffer, ack, read, send: vi.fn().mockResolvedValue(result), result }
}

it("returns terminal deletion without reading, sending, requeueing or clearing the retained pending operation", async () => {
  const owner = "sync-deleted-before-read", f = fixture(owner)
  closeAccountDeletionBoundary(owner, instant)
  expect(await flushAccountJournalDraft(f.buffer, owner, doc, f.send, () => true)).toBe("ACCOUNT_DELETION_REQUESTED")
  expect(f.read).not.toHaveBeenCalled()
  expect(f.send).not.toHaveBeenCalled()
  expect(f.buffer.clear).not.toHaveBeenCalled()
  expect(f.view.pending?.operationId).toBe(operationId)
  expect(f.view.draft).toBe(draft)
})

it("refuses a late ACK after deletion even if the caller's user-id-only gate still says current", async () => {
  const owner = "sync-late-delete", f = fixture(owner)
  let resolve!: (result: AccountJournalResult<AccountJournalDraft>) => void
  f.send.mockImplementation(() => new Promise(done => { resolve = done }))
  const acknowledged = vi.fn()
  const flushing = flushAccountJournalDraft(f.buffer, owner, doc, f.send, () => true, acknowledged)
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledOnce())
  closeAccountDeletionBoundary(owner, instant)
  resolve(f.result)
  expect(await flushing).toBe("ACCOUNT_DELETION_REQUESTED")
  expect(f.ack).not.toHaveBeenCalled()
  expect(acknowledged).not.toHaveBeenCalled()
  expect(f.view.pending?.draft).toBe(draft)
})

it("keeps the normal owner's exact fixed-operation acknowledgement path", async () => {
  const owner = "sync-normal-owner", f = fixture(owner)
  f.read.mockResolvedValueOnce(f.view).mockResolvedValue({ ...f.view, state: "DRAFT_ACKNOWLEDGED", pending: null })
  const acknowledged = vi.fn()
  expect(await flushAccountJournalDraft(f.buffer, owner, doc, f.send, () => true, acknowledged)).toBe("SAVED")
  expect(f.ack).toHaveBeenCalledWith(owner, doc, operationId, 1)
  expect(acknowledged).toHaveBeenCalledWith(draft, 1)
  expect(f.buffer.clear).not.toHaveBeenCalled()
})

it("retains UNKNOWN local boundary as pending without reading or sending", async () => {
  const owner = "sync-unknown-owner", f = fixture(owner)
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("synthetic unavailable") })
  expect(await flushAccountJournalDraft(f.buffer, owner, doc, f.send, () => true)).toBe("PENDING")
  expect(f.read).not.toHaveBeenCalled()
  expect(f.send).not.toHaveBeenCalled()
  expect(f.buffer.clear).not.toHaveBeenCalled()
  read.mockRestore()
})

it("does not announce acknowledgement when deletion closes while a buffer ACK is settling", async () => {
  const owner = "sync-ack-deletion", f = fixture(owner)
  f.ack.mockImplementation(async () => {
    closeAccountDeletionBoundary(owner, instant)
    return true
  })
  const acknowledged = vi.fn()
  expect(await flushAccountJournalDraft(f.buffer, owner, doc, f.send, () => true, acknowledged)).toBe("ACCOUNT_DELETION_REQUESTED")
  expect(acknowledged).not.toHaveBeenCalled()
})
