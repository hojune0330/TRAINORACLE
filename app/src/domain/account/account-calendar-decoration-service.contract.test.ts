import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountCalendarDecorationDocument } from "./account-calendar-decoration-schema"
import type { AccountJournalDraftView, AccountJournalConflictBuffer, AccountJournalConflictArchive } from "./account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"
import { createEmptyDecorationState } from "../decoration-schema"
import { createEmptyCalendarDecorationState } from "../calendar-decoration-schema"

const mocks = vi.hoisted(() => ({ owner: "a1111111-1111-4111-8111-111111111111" as string | null,
  enabled: true, changed: null as null | (() => void), request: vi.fn(), create: vi.fn(),
  inventoryStatus: "READY", owned: null as unknown, hydrate: vi.fn(), persist: vi.fn() }))
vi.mock("./account-journal-api", () => ({ requestAccountDocument: mocks.request }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: mocks.create }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner,
  onLocalJournalScopeChange: (fn: () => void) => { mocks.changed = fn; return () => { mocks.changed = null } } }))
vi.mock("./account-decoration-service", () => ({ accountDecorationsEnabled: () => mocks.enabled,
  accountDecorationStatus: () => mocks.inventoryStatus, readAccountDecorationState: () => mocks.owned,
  hydrateAccountDecorations: mocks.hydrate, persistAccountDecorations: mocks.persist }))
import { accountCalendarDecorationExportReady, accountCalendarDecorationStatus,
  readAccountCalendarDecorationState, accountCalendarDecorationDocumentId,
  hydrateAccountCalendarDecorations, refreshAccountCalendarDecorationsForExport,
  persistAccountCalendarDecorations, disposeAccountCalendarDecorations } from "./account-calendar-decoration-service"

const A = "a1111111-1111-4111-8111-111111111111", B = "b2222222-2222-4222-8222-222222222222"
const empty = createEmptyCalendarDecorationState()
const decorated = { ...empty, items: [{ placementId: "11111111-1111-4111-8111-111111111111", itemId: "EMOJI_SUN" as const,
  region: "HEADER_MARGIN" as const, transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }
const calendarDocument = (data = empty): AccountCalendarDecorationDocument => ({
  version: 3, state: "ACCOUNT_STATE", kind: "CALENDAR_DECORATIONS", data,
})
// Protocol/CAS double only: encryption, IndexedDB reopen and real tabs are not proven here.
function memoryBuffer() {
  let view: AccountJournalDraftView<AccountCalendarDecorationDocument> | null = null
  const archive: AccountJournalConflictArchive<AccountCalendarDecorationDocument>[] = []
  const local = {
    close: vi.fn(), read: async () => structuredClone(view),
    saveDraft: vi.fn(async (ownerId: string, documentId: string, draft: AccountCalendarDecorationDocument, sequence: number) => {
      if ((view?.localSequence ?? 0) !== sequence) throw Error("Local CAS")
      view = { ownerId, documentId, draft: structuredClone(draft), serverRevision: view?.serverRevision ?? 0,
        localSequence: sequence + 1, acknowledgedSequence: view?.acknowledgedSequence ?? 0,
        pending: view?.pending ?? null, blocked: view?.blocked ?? null, remoteDraft: null, state: "LOCAL_CHANGES" }
    }),
    queue: async (_owner: string, _id: string, operationId: string) => {
      if (!view || view.pending) throw Error("Queue")
      view.pending = { operationId, expectedRevision: view.serverRevision, sequence: view.localSequence, draft: structuredClone(view.draft) }
      view.state = "PENDING"
    },
    ack: async (_owner: string, _id: string, operationId: string, revision: number) => {
      if (!view || view.pending?.operationId !== operationId) return false
      view.acknowledgedSequence = view.pending.sequence; view.serverRevision = revision; view.pending = null
      view.state = view.localSequence === view.acknowledgedSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"; return true
    },
    reject: async (_owner: string, _id: string, operationId: string, reason: "OWNERSHIP_STATE_CHANGED") => {
      if (!view?.pending || view.pending.operationId !== operationId) return false
      view.pending.rejection = reason; return true
    },
    retryOwnershipChanged: async (_owner: string, _id: string, operationId: string, current: () => boolean) => {
      if (!current() || !view?.pending || view.pending.operationId !== operationId || view.pending.rejection !== "OWNERSHIP_STATE_CHANGED") return false
      delete view.pending.rejection; return true
    },
    replaceOwnershipRejectedDraft: vi.fn(async (owner: string, _id: string, draft: AccountCalendarDecorationDocument,
      operationId: string, sequence: number, revision: number, remote: AccountCalendarDecorationDocument | null,
      replacementId: string, current: () => boolean) => {
      if (!current() || !view || view.ownerId !== owner || view.localSequence !== sequence || view.serverRevision !== revision
        || view.blocked || view.pending?.operationId !== operationId || view.pending.rejection !== "OWNERSHIP_STATE_CHANGED") return false
      archive.push({ version: 1, createdAt: null, localServerRevision: view.serverRevision, localSequence: view.localSequence,
        remoteRevision: revision, deleted: false, choice: "LOCAL", local: structuredClone(view.draft), remote,
        pending: structuredClone(view.pending) })
      view.localSequence += 1; view.draft = structuredClone(draft)
      view.pending = { operationId: replacementId, expectedRevision: revision, sequence: view.localSequence, draft: structuredClone(draft) }
      view.state = "PENDING"; return true
    }),
    captureConflict: async (_owner: string, _id: string, remote: AccountCalendarDecorationDocument | null, revision: number) => {
      if (!view) throw Error("Missing draft")
      view.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; view.remoteDraft = remote; view.state = "CONFLICT"
    },
    conflict: async (_owner: string, _id: string, operationId: string, revision: number) => {
      if (!view) return false
      view.blocked = { kind: "RECEIPT", operationId, currentRevision: revision }; view.state = "CONFLICT"; return true
    },
    importRemote: async (ownerId: string, documentId: string, draft: AccountCalendarDecorationDocument, revision: number) => {
      if (view && view.state !== "DRAFT_ACKNOWLEDGED") {
        if (view.serverRevision === revision) return "UNCHANGED" as const
        view.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; view.state = "CONFLICT"
        return "CONFLICT" as const
      }
      view = { ownerId, documentId, draft, serverRevision: revision, localSequence: 1, acknowledgedSequence: 1,
        pending: null, blocked: null, remoteDraft: null, state: "DRAFT_ACKNOWLEDGED" }; return "IMPORTED" as const
    },
  } as unknown as AccountJournalConflictBuffer<AccountCalendarDecorationDocument>
  return { local, view: () => view, archive }
}
function server() {
  let document: AccountCalendarDecorationDocument | null = null, revision = 0, lose = false, reject = false, readUnavailable = false, offline = false
  const receipts = new Map<string, { body: string; revision: number }>()
  mocks.request.mockImplementation(async (_owner: string, request: AccountJournalRequest<AccountCalendarDecorationDocument>): Promise<AccountJournalResult<AccountCalendarDecorationDocument>> => {
    if (request.action === "calendarDecorationSupport") return { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    if (request.action === "read") return readUnavailable ? { ok: false, code: "UNAVAILABLE" } : document ? { ok: true, data: { kind: "document", documentId: request.documentId, document, revision } } : { ok: false, code: "NOT_FOUND" }
    if (request.action !== "save") return { ok: false, code: "UNAVAILABLE" }
    if (offline) return { ok: false, code: "UNAVAILABLE" }
    const receipt = receipts.get(request.operationId)
    if (receipt) { expect(JSON.stringify(request)).toBe(receipt.body); return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: receipt.revision } } }
    if (reject) { reject = false; return { ok: false, code: "OWNERSHIP_STATE_CHANGED" } }
    revision += 1; document = structuredClone(request.document); receipts.set(request.operationId, { body: JSON.stringify(request), revision })
    if (lose) { lose = false; return { ok: false, code: "UNAVAILABLE" } }
    return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision } }
  })
  return { revision: () => revision, lose: () => { lose = true }, reject: () => { reject = true },
    readUnavailable: () => { readUnavailable = true }, offline: () => { offline = true },
    advance: () => { revision += 1; document = { version: 3, state: "ACCOUNT_STATE", kind: "CALENDAR_DECORATIONS", data: empty } } }
}
beforeEach(() => {
  disposeAccountCalendarDecorations(); mocks.owner = A; mocks.enabled = true; mocks.inventoryStatus = "READY"
  mocks.owned = createEmptyDecorationState(); mocks.request.mockReset(); mocks.create.mockReset(); mocks.persist.mockReset(); mocks.hydrate.mockReset()
  mocks.hydrate.mockResolvedValue(true); mocks.persist.mockImplementation(async () => { mocks.inventoryStatus = "READY"; return { ok: true, storage: "ACCOUNT" } })
  vi.stubGlobal("crypto", webcrypto)
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, run: () => unknown) => run() } })
})
afterEach(() => { disposeAccountCalendarDecorations(); vi.unstubAllGlobals() })

it("requires positive server support and a Web Lock before any calendar write, preserving existing journal paths", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  mocks.request.mockResolvedValue({ ok: false, code: "INVALID_RESPONSE" })
  expect(await hydrateAccountCalendarDecorations()).toBe(false)
  expect(accountCalendarDecorationStatus()).toBe("UNSUPPORTED")
  expect(await persistAccountCalendarDecorations(empty, null)).toEqual({ ok: false, code: "UNSUPPORTED" })
  expect(local.local.saveDraft).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled()
  disposeAccountCalendarDecorations(); vi.stubGlobal("navigator", {})
  mocks.request.mockClear(); expect(await hydrateAccountCalendarDecorations()).toBe(false); expect(mocks.request).not.toHaveBeenCalled()
})

it.each([
  ["CALENDAR_DECORATION_UNSUPPORTED", "UNSUPPORTED", "UNSUPPORTED"],
  ["UNAVAILABLE", "FAILED", "STORAGE_UNAVAILABLE"],
] as const)("capability %s stays %s without inventing EMPTY or touching the outbox", async (code, status, saveCode) => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  mocks.request.mockResolvedValue({ ok: false, code })
  expect(await hydrateAccountCalendarDecorations()).toBe(false)
  expect(accountCalendarDecorationStatus()).toBe(status)
  expect(readAccountCalendarDecorationState()).toBeNull()
  expect(await persistAccountCalendarDecorations(empty, null)).toEqual({ ok: false, code: saveCode })
  expect(local.local.saveDraft).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled()
  expect(mocks.request.mock.calls.every(call => call[1].action === "calendarDecorationSupport")).toBe(true)
})

it("an outage on the save-time support recheck stays FAILED without creating a draft", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); server()
  await hydrateAccountCalendarDecorations()
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(empty)))
    .toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" })
  expect(accountCalendarDecorationStatus()).toBe("FAILED")
  expect(local.local.saveDraft).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled()
})

it("confirmed EMPTY reads a global empty calendar and seeds starter canonical decorations before the first calendar save", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); const remote = server(); mocks.inventoryStatus = "EMPTY"
  expect(await hydrateAccountCalendarDecorations()).toBe(true); expect(accountCalendarDecorationStatus()).toBe("EMPTY")
  expect(readAccountCalendarDecorationState()).toEqual(empty)
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(empty))).toMatchObject({ ok: true, storage: "ACCOUNT", state: decorated })
  expect(mocks.persist).toHaveBeenCalledTimes(1); expect(remote.revision()).toBe(1)
  expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(local.local.saveDraft).mock.invocationCallOrder[0]!)
})

it("lost acknowledgements replay the same fixed calendar operation before importing the remote snapshot", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); const remote = server(); await hydrateAccountCalendarDecorations(); remote.lose()
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(empty))).toMatchObject({ ok: true, storage: "PENDING" })
  const fixed = structuredClone(local.view()!.pending)
  expect(fixed).not.toBeNull(); expect(await hydrateAccountCalendarDecorations()).toBe(true)
  const saves = mocks.request.mock.calls.filter(call => call[1].action === "save")
  expect(saves).toHaveLength(2); expect(saves[1]?.[1]).toEqual(saves[0]?.[1]); expect(remote.revision()).toBe(1)
  expect(local.view()!.pending).toBeNull()
})

it("stale sessions and unknown remote versions never create or replace the calendar outbox", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); server(); await hydrateAccountCalendarDecorations()
  expect(await persistAccountCalendarDecorations(decorated, null)).toEqual({ ok: false, code: "STALE_STATE" })
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } } : { ok: false, code: "INVALID_RESPONSE" })
  expect(await hydrateAccountCalendarDecorations()).toBe(false)
  expect(accountCalendarDecorationStatus()).toBe("UNSUPPORTED")
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(empty))).toEqual({ ok: false, code: "UNSUPPORTED" })
  expect(local.local.saveDraft).not.toHaveBeenCalled()
})

it("explicit ownership-race retry preserves and replays the immutable rejected operation", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); const remote = server(); await hydrateAccountCalendarDecorations(); remote.reject()
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(empty))).toEqual({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  const fixed = structuredClone(local.view()!.pending)
  expect(accountCalendarDecorationStatus()).toBe("OWNERSHIP_STATE_CHANGED")
  expect(await persistAccountCalendarDecorations(decorated, JSON.stringify(decorated))).toMatchObject({ ok: true, storage: "ACCOUNT" })
  const saves = mocks.request.mock.calls.filter(call => call[1].action === "save")
  expect(saves[1]?.[1].operationId).toBe(fixed?.operationId)
  expect(saves[1]?.[1].document).toEqual(fixed?.draft)
})

const paid = { ...decorated, items: [{ ...decorated.items[0]!, itemId: "STICKER_FINISH_LINE" as const }] }
async function rejectedPaidDraft() {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); const remote = server()
  mocks.owned = { ...createEmptyDecorationState(), spentPoints: 100_000,
    ownedItemIds: [...createEmptyDecorationState().ownedItemIds, "STICKER_FINISH_LINE"] }
  await hydrateAccountCalendarDecorations(); remote.reject()
  expect(await persistAccountCalendarDecorations(paid, JSON.stringify(empty))).toEqual({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  const fixed = structuredClone(local.view()!.pending!)
  mocks.owned = createEmptyDecorationState()
  return { local, remote, fixed }
}

it("explicit removal of revoked art replaces the rejected initial operation only after unchanged remote CAS, keeping original bytes archived", async () => {
  const { local, remote, fixed } = await rejectedPaidDraft()
  expect(await persistAccountCalendarDecorations(empty, JSON.stringify(paid))).toMatchObject({ ok: true, storage: "ACCOUNT", state: empty })
  const saves = mocks.request.mock.calls.filter(call => call[1].action === "save")
  expect(saves).toHaveLength(2); expect(saves[1]?.[1].operationId).not.toBe(fixed.operationId)
  expect(saves[1]?.[1]).toMatchObject({ expectedRevision: 0, document: { data: empty } })
  expect(local.archive[0]?.pending).toEqual(fixed); expect(remote.revision()).toBe(1)
  expect(mocks.request.mock.calls.some(call => call[1].action === "delete")).toBe(false)
})

it("corrected candidate and immutable rejected original remain durable when the verified base read fails", async () => {
  const { local, remote, fixed } = await rejectedPaidDraft(); remote.readUnavailable()
  expect(await persistAccountCalendarDecorations(empty, JSON.stringify(paid))).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" })
  expect(local.view()?.draft.data).toEqual(empty); expect(local.view()?.pending).toEqual(fixed)
  expect(local.local.replaceOwnershipRejectedDraft).not.toHaveBeenCalled(); expect(local.archive).toEqual([])
})

it("corrected replacement retains both archived original and new pending operation when its save is offline", async () => {
  const { local, remote, fixed } = await rejectedPaidDraft(); remote.offline()
  expect(await persistAccountCalendarDecorations(empty, JSON.stringify(paid))).toMatchObject({ ok: true, storage: "PENDING", state: empty })
  expect(local.view()?.pending).toMatchObject({ expectedRevision: 0, draft: { data: empty } })
  expect(local.view()?.pending?.operationId).not.toBe(fixed.operationId); expect(local.archive[0]?.pending).toEqual(fixed)
})

it("a newer remote calendar stays CONFLICT and never silently rebases a corrected replacement", async () => {
  const { local, remote, fixed } = await rejectedPaidDraft(); remote.advance()
  expect(await persistAccountCalendarDecorations(empty, JSON.stringify(paid))).toEqual({ ok: false, code: "STALE_STATE" })
  expect(accountCalendarDecorationStatus()).toBe("CONFLICT")
  expect(local.view()).toMatchObject({ draft: { data: empty }, pending: fixed, blocked: { currentRevision: 1 } })
  expect(local.local.replaceOwnershipRejectedDraft).not.toHaveBeenCalled()
  expect(mocks.request.mock.calls.filter(call => call[1].action === "save")).toHaveLength(1)
})

it("a still-unowned candidate cannot retire or replace the rejected snapshot", async () => {
  const { local, fixed } = await rejectedPaidDraft()
  const candidate = { ...paid, paperThemeId: "THEME_TRACK_NOTEBOOK" as const }
  expect(await persistAccountCalendarDecorations(candidate, JSON.stringify(paid))).toEqual({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  expect(local.view()?.pending).toEqual(fixed); expect(local.local.replaceOwnershipRejectedDraft).not.toHaveBeenCalled()
})

it("a late corrected-base response cannot retire or publish a previous owner's rejected operation", async () => {
  const { local, fixed } = await rejectedPaidDraft()
  const previous = mocks.request.getMockImplementation()!
  let release!: (value: AccountJournalResult<AccountCalendarDecorationDocument>) => void
  mocks.request.mockImplementation((owner, request, ...rest) => request.action === "read"
    ? new Promise(resolve => { release = resolve }) : previous(owner, request, ...rest))
  const saving = persistAccountCalendarDecorations(empty, JSON.stringify(paid))
  await vi.waitFor(() => expect(release).toBeTypeOf("function"))
  mocks.owner = B; mocks.changed?.(); release({ ok: false, code: "NOT_FOUND" })
  expect(await saving).toEqual({ ok: false, code: "STALE_STATE" })
  expect(local.view()?.pending).toEqual(fixed); expect(local.view()?.draft.data).toEqual(empty)
  expect(local.local.replaceOwnershipRejectedDraft).not.toHaveBeenCalled(); expect(readAccountCalendarDecorationState()).toBeNull()
})

it("late A hydration and signed-out gaps never publish another owner's calendar", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); let resolve!: (value: unknown) => void
  mocks.request.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const running = hydrateAccountCalendarDecorations(); await vi.waitFor(() => expect(resolve).toBeTypeOf("function"))
  mocks.owner = B; mocks.changed?.(); resolve({ ok: true, data: { kind: "calendar-decoration-support", version: 1 } })
  expect(await running).toBe(false); expect(readAccountCalendarDecorationState()).toBeNull()
  server(); await hydrateAccountCalendarDecorations(); expect(readAccountCalendarDecorationState()).toEqual(empty)
  expect(await accountCalendarDecorationDocumentId(A)).not.toBe(await accountCalendarDecorationDocumentId(B))
  mocks.owner = null; mocks.changed?.(); expect(readAccountCalendarDecorationState()).toBeNull(); expect(accountCalendarDecorationStatus()).toBe("AUTH_REQUIRED")
})

it("does not let a stale pre-click READY calendar authorize a full backup", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    : { ok: true, data: { kind: "document", documentId: request.documentId, document: calendarDocument(decorated), revision: 1 } })
  await expect(hydrateAccountCalendarDecorations()).resolves.toBe(true)
  expect(accountCalendarDecorationStatus()).toBe("READY")

  let release!: () => void
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    : new Promise(resolve => { release = () => resolve({ ok: false, code: "UNAVAILABLE" }) }))
  const refreshing = refreshAccountCalendarDecorationsForExport()
  await vi.waitFor(() => expect(release).toBeTypeOf("function"))
  expect(accountCalendarDecorationStatus()).toBe("LOADING")
  release()
  await expect(refreshing).resolves.toBe(false)
  expect(accountCalendarDecorationStatus()).toBe("FAILED")
})

it("rejects a late calendar export refresh after an A-B-A account switch", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  let release!: () => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => {
    release = () => resolve({ ok: true, data: { kind: "calendar-decoration-support", version: 1 } })
  }))
  const refreshing = refreshAccountCalendarDecorationsForExport()
  await vi.waitFor(() => expect(release).toBeTypeOf("function"))
  mocks.owner = B; mocks.changed?.()
  mocks.owner = A; mocks.changed?.()
  release()
  await expect(refreshing).resolves.toBe(false)
  expect(readAccountCalendarDecorationState()).toBeNull()
})

it("publishes a fresh calendar snapshot for full-backup serialization", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  let remote = calendarDocument(empty), revision = 1
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    : { ok: true, data: { kind: "document", documentId: request.documentId, document: remote, revision } })
  await expect(hydrateAccountCalendarDecorations()).resolves.toBe(true)
  expect(readAccountCalendarDecorationState()).toEqual(empty)

  remote = calendarDocument(decorated); revision = 2
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(true)
  expect(accountCalendarDecorationStatus()).toBe("READY")
  expect(readAccountCalendarDecorationState()).toEqual(decorated)
})

it("lets an already queued calendar save finish before the export refresh changes status", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local); const remote = server()
  await expect(hydrateAccountCalendarDecorations()).resolves.toBe(true)

  const saving = persistAccountCalendarDecorations(decorated, JSON.stringify(empty))
  const refreshing = refreshAccountCalendarDecorationsForExport()

  await expect(saving).resolves.toMatchObject({ ok: true, storage: "ACCOUNT", state: decorated })
  await expect(refreshing).resolves.toBe(true)
  expect(remote.revision()).toBe(1)
  expect(accountCalendarDecorationStatus()).toBe("READY")
  expect(readAccountCalendarDecorationState()).toEqual(decorated)
})

it("allows only an explicit unsupported capability to produce the established v4 exclusion", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  mocks.request.mockResolvedValueOnce({ ok: false, code: "CALENDAR_DECORATION_UNSUPPORTED" })
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(true)
  expect(accountCalendarDecorationStatus()).toBe("UNSUPPORTED")
  expect(accountCalendarDecorationExportReady()).toBe(true)

  disposeAccountCalendarDecorations(); mocks.create.mockReturnValue(memoryBuffer().local)
  mocks.request.mockResolvedValueOnce({ ok: false, code: "INVALID_RESPONSE" })
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(false)
  expect(accountCalendarDecorationStatus()).toBe("UNSUPPORTED")
  expect(accountCalendarDecorationExportReady()).toBe(false)

  disposeAccountCalendarDecorations(); mocks.create.mockReturnValue(memoryBuffer().local)
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    : { ok: false, code: "INVALID_RESPONSE" })
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(false)
  expect(accountCalendarDecorationStatus()).toBe("UNSUPPORTED")
  expect(accountCalendarDecorationExportReady()).toBe(false)
})

it("requires every fresh calendar reference to be owned by the fresh decoration projection", async () => {
  const local = memoryBuffer(); mocks.create.mockReturnValue(local.local)
  const paidCalendar = { ...empty, items: [{ ...decorated.items[0]!, itemId: "STICKER_FINISH_LINE" as const }] }
  mocks.request.mockImplementation(async (_owner, request) => request.action === "calendarDecorationSupport"
    ? { ok: true, data: { kind: "calendar-decoration-support", version: 1 } }
    : { ok: true, data: { kind: "document", documentId: request.documentId, document: calendarDocument(paidCalendar), revision: 1 } })
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(true)
  expect(accountCalendarDecorationExportReady()).toBe(false)

  mocks.owned = { ...createEmptyDecorationState(), spentPoints: 100_000,
    ownedItemIds: [...createEmptyDecorationState().ownedItemIds, "STICKER_FINISH_LINE"] }
  expect(accountCalendarDecorationExportReady()).toBe(true)
})

it("leaves the device-only calendar backup path free of account reads", async () => {
  mocks.enabled = false
  await expect(refreshAccountCalendarDecorationsForExport()).resolves.toBe(true)
  expect(accountCalendarDecorationExportReady()).toBe(true)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.request).not.toHaveBeenCalled()
})
