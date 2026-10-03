import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createEmptyDecorationState } from "../decoration-schema"
import { setActiveLocalAccount } from "./local-journal-ownership"
import type { AccountDecorationDocument } from "./account-decoration-schema"
import type { AccountJournalDraftView } from "./account-journal-draft-buffer"

const mocks = vi.hoisted(() => ({
  enabled: true,
  request: vi.fn(),
  create: vi.fn(),
}))

vi.mock("./account-journal-api", () => ({ requestAccountDocument: mocks.request }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: mocks.create }))
vi.mock("./account-journal-sync", () => ({ flushAccountJournalDraft: vi.fn() }))
vi.mock("./account-reward-service", () => ({
  accountRewardsEnabled: () => mocks.enabled,
  hydrateAccountRewards: vi.fn(),
}))

import {
  accountDecorationStatus,
  disposeAccountDecorations,
  hydrateAccountDecorations,
  persistAccountDecorations,
  readAccountDecorationState,
  refreshAccountDecorationsForExport,
} from "./account-decoration-service"

const A = "a1111111-1111-4111-8111-111111111111"
const B = "b2222222-2222-4222-8222-222222222222"
const stale = createEmptyDecorationState()
const fresh = {
  ...stale,
  library: { ...stale.library, favoriteItemIds: ["STICKER_WEATHER_SUN" as const] },
}
const document = (data = stale): AccountDecorationDocument => ({
  version: 3,
  state: "ACCOUNT_STATE",
  kind: "DECORATIONS",
  data,
})

function memoryBuffer() {
  let view: AccountJournalDraftView<AccountDecorationDocument> | null = null
  return {
    close: vi.fn(),
    read: vi.fn(async () => view === null ? null : structuredClone(view)),
    importRemote: vi.fn(async (ownerId: string, documentId: string, draft: AccountDecorationDocument, revision: number) => {
      view = {
        ownerId,
        documentId,
        draft: structuredClone(draft),
        serverRevision: revision,
        localSequence: 1,
        acknowledgedSequence: 1,
        pending: null,
        blocked: null,
        remoteDraft: null,
        state: "DRAFT_ACKNOWLEDGED",
      }
      return "IMPORTED" as const
    }),
    saveDraft: vi.fn(async (ownerId: string, documentId: string, draft: AccountDecorationDocument, sequence: number) => {
      if (!view || view.localSequence !== sequence) throw new Error("Local CAS")
      view = { ...view, ownerId, documentId, draft: structuredClone(draft), localSequence: sequence + 1,
        state: "LOCAL_CHANGES" }
    }),
  }
}

function response(data: ReturnType<typeof document>, revision: number) {
  return { ok: true as const, data: { kind: "document" as const, documentId: "synthetic", document: data, revision } }
}

beforeEach(() => {
  disposeAccountDecorations()
  mocks.enabled = true
  mocks.request.mockReset()
  mocks.create.mockReset().mockImplementation(() => memoryBuffer())
  vi.stubGlobal("crypto", webcrypto)
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, run: () => unknown) => run() } })
  setActiveLocalAccount(A)
})

afterEach(() => {
  disposeAccountDecorations()
  setActiveLocalAccount(null)
  vi.unstubAllGlobals()
})

it("does not let a stale pre-click READY projection authorize a full backup", async () => {
  mocks.request.mockResolvedValueOnce(response(document(stale), 1))
  await expect(hydrateAccountDecorations()).resolves.toBe(true)
  expect(accountDecorationStatus()).toBe("READY")

  let release!: () => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => {
    release = () => resolve({ ok: false, code: "UNAVAILABLE" })
  }))
  const refreshing = refreshAccountDecorationsForExport()
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
  expect(accountDecorationStatus()).toBe("LOADING")
  let settled = false
  void refreshing.then(() => { settled = true })
  await Promise.resolve()
  expect(settled).toBe(false)
  release()

  await expect(refreshing).resolves.toBe(false)
  expect(accountDecorationStatus()).toBe("FAILED")
})

it("rejects a late export refresh after an A-B-A account switch", async () => {
  let release!: () => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => {
    release = () => resolve(response(document(fresh), 2))
  }))
  const refreshing = refreshAccountDecorationsForExport()
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce())
  setActiveLocalAccount(B)
  setActiveLocalAccount(A)
  release()

  await expect(refreshing).resolves.toBe(false)
  expect(readAccountDecorationState()).toBeNull()
})

it("publishes the fresh authenticated snapshot used by full-backup serialization", async () => {
  mocks.request.mockResolvedValueOnce(response(document(stale), 1)).mockResolvedValueOnce(response(document(fresh), 2))
  await expect(hydrateAccountDecorations()).resolves.toBe(true)
  expect(readAccountDecorationState()).toEqual(stale)

  await expect(refreshAccountDecorationsForExport()).resolves.toBe(true)
  expect(mocks.request).toHaveBeenCalledTimes(2)
  expect(accountDecorationStatus()).toBe("READY")
  expect(readAccountDecorationState()).toEqual(fresh)
})

it("lets an already queued decoration save finish before the export refresh changes status", async () => {
  mocks.request.mockResolvedValueOnce(response(document(stale), 1)).mockResolvedValueOnce(response(document(fresh), 2))
  await expect(hydrateAccountDecorations()).resolves.toBe(true)

  const saving = persistAccountDecorations(fresh, JSON.stringify(stale))
  const refreshing = refreshAccountDecorationsForExport()

  await expect(saving).resolves.toMatchObject({ ok: true, storage: "PENDING", state: fresh })
  await expect(refreshing).resolves.toBe(true)
  expect(accountDecorationStatus()).toBe("READY")
  expect(readAccountDecorationState()).toEqual(fresh)
})

it("leaves the device-only decoration backup path free of account reads", async () => {
  mocks.enabled = false
  await expect(refreshAccountDecorationsForExport()).resolves.toBe(true)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.request).not.toHaveBeenCalled()
})
