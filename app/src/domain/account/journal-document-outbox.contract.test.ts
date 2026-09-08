import { describe, expect, it } from "vitest"
import {
  acknowledgeJournalDocument, createJournalDocumentOutbox, editJournalDocumentDraft,
  journalDocumentDraftStatus, queueJournalDocument, readJournalDocumentOutbox,
} from "./journal-document-outbox"

const ownerId = "a1111111-1111-4111-8111-111111111111"
const other = "b2222222-2222-4222-8222-222222222222"
const documentId = "c3333333-3333-4333-8333-333333333333"
const op = "d4444444-4444-4444-8444-444444444444"
const op2 = "e5555555-5555-4555-8555-555555555555"
const envelope = { version: 1 as const, algorithm: "AES-GCM" as const,
  keyId: "synthetic-key-v1", iv: "AAAAAAAAAAAAAAAA", ciphertext: "AAAAAAAAAAAAAAAAAAAAAA==" }
const session = { ownerId, epoch: 1 }
const create = () => createJournalDocumentOutbox({ ownerId, documentId, encryptedPayload: envelope })
const saved = (operationId = op, revision = 1) => ({ kind: "saved", documentId, operationId, revision })
const ack = (state: ReturnType<typeof create>, receipt: unknown = saved()) => acknowledgeJournalDocument({
  state, receipt, sentSession: session, currentSession: session,
})

describe("account journal draft outbox (pure protocol, not durable storage)", () => {
  it("does not call a local draft saved", () => {
    expect(journalDocumentDraftStatus(create())).toBe("LOCAL_CHANGES")
  })
  it("queues an immutable operation and retries the same identity", () => {
    const queued = queueJournalDocument(create(), op)
    expect(queueJournalDocument(queued, op2)).toBe(queued)
    expect(Object.isFrozen(queued.pending?.encryptedPayload)).toBe(true)
    expect(journalDocumentDraftStatus(queued)).toBe("PENDING")
  })
  it("a late ACK cannot erase later edits", () => {
    const queued = queueJournalDocument(create(), op)
    const edited = editJournalDocumentDraft(queued, { ...envelope, keyId: "new-draft" })
    const confirmed = ack(edited)
    expect(confirmed.draft.keyId).toBe("new-draft")
    expect(confirmed.acknowledgedLocalRevision).toBe(1)
    expect(journalDocumentDraftStatus(confirmed)).toBe("LOCAL_CHANGES")
    const next = queueJournalDocument(confirmed, op2)
    expect(next.pending?.expectedRevision).toBe(1)
    expect(next.pending?.encryptedPayload.keyId).toBe("new-draft")
  })
  it("ACK means draft acknowledged, never completed journal or reward", () => {
    const confirmed = ack(queueJournalDocument(create(), op))
    expect(journalDocumentDraftStatus(confirmed)).toBe("DRAFT_ACKNOWLEDGED")
    expect(queueJournalDocument(confirmed, op2)).toBe(confirmed)
    expect(confirmed).not.toHaveProperty("completed")
    expect(confirmed).not.toHaveProperty("points")
  })
  it("preserves conflict attempt and more recent local edits without retrying over it", () => {
    const edited = editJournalDocumentDraft(queueJournalDocument(create(), op), { ...envelope, keyId: "later" })
    const conflicted = ack(edited, { kind: "conflict", documentId, operationId: op, currentRevision: 2 })
    expect(conflicted.conflict?.attempted.encryptedPayload.keyId).toBe(envelope.keyId)
    expect(conflicted.draft.keyId).toBe("later")
    expect(journalDocumentDraftStatus(conflicted)).toBe("CONFLICT")
    expect(queueJournalDocument(conflicted, op2)).toBe(conflicted)
  })
  it.each([
    null, { ownerId: other, epoch: 1 }, { ownerId, epoch: 2 },
  ])("ignores receipts after logout/account switch/session epoch change %j", currentSession => {
    const state = queueJournalDocument(create(), op)
    expect(acknowledgeJournalDocument({ state, receipt: saved(), sentSession: session, currentSession })).toBe(state)
  })
  it.each([
    saved(op2), saved(op, 3), { ...saved(), documentId: other },
    { ...saved(), extra: "no" }, { ...saved(), revision: null },
    { kind: "conflict", documentId, operationId: op, currentRevision: 0 },
  ])("ignores malformed or unrelated receipts %j", receipt => {
    const state = queueJournalDocument(create(), op)
    expect(ack(state, receipt)).toBe(state)
  })
  it("survives serialization without recreating an in-flight operation", () => {
    const state = queueJournalDocument(create(), op)
    const loaded = readJournalDocumentOutbox(JSON.parse(JSON.stringify(state)))!
    expect(loaded).toEqual(state)
    expect(Object.isFrozen(loaded.pending?.encryptedPayload)).toBe(true)
    expect(ack(loaded).serverRevision).toBe(1)
  })
  it("does not accept a broken saved lineage", () => {
    const state = queueJournalDocument(create(), op)
    expect(readJournalDocumentOutbox({ ...state, acknowledgedLocalRevision: 5 })).toBeNull()
    expect(readJournalDocumentOutbox({ ...state, pending: { ...state.pending, documentId: other } })).toBeNull()
    expect(readJournalDocumentOutbox({ ...state, serverRevision: 3 })).toBeNull()
    expect(readJournalDocumentOutbox({ ...state, draft: { ...envelope, keyId: "silently-edited" } })).toBeNull()
    expect(readJournalDocumentOutbox({ ...state, memo: "synthetic plaintext" })).toBeNull()
  })
  it("receiving the same ACK twice does not advance again", () => {
    const first = ack(queueJournalDocument(create(), op))
    expect(ack(first)).toBe(first)
  })
  it("rejects a persisted ACK without any server revision", () => {
    expect(readJournalDocumentOutbox({ ...create(), acknowledgedLocalRevision: 1 })).toBeNull()
  })
})
