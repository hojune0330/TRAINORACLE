import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./local-journal-ownership"

const state = vi.hoisted(() => ({
  enabled: true,
  request: vi.fn(),
  list: vi.fn(async () => []),
  importRemote: vi.fn(),
  close: vi.fn(),
}))

vi.mock("./account-journal-api", () => ({
  accountJournalPreviewEnabled: () => state.enabled,
  requestAccountDocument: state.request,
}))
vi.mock("./account-journal-draft-buffer", () => ({
  createAccountDocumentBuffer: () => ({
    close: state.close,
    list: state.list,
    importRemote: state.importRemote,
  }),
}))
vi.mock("./account-journal-sync", () => ({ flushAccountJournalDraft: vi.fn() }))

import {
  disposeAccountJournalRecords,
  hydrateAccountJournalRecords,
  refreshAccountJournalRecordsForExport,
} from "./account-journal-record-service"

const emptyList = { ok: true as const, data: { kind: "list" as const, documents: [], deletedDocuments: [], nextCursor: null } }

beforeEach(() => {
  state.enabled = true
  state.request.mockReset()
  state.list.mockClear()
  state.importRemote.mockClear()
  state.close.mockClear()
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (...args: unknown[]) => {
        const callback = args.at(-1)
        if (typeof callback !== "function") throw new Error("Missing lock callback")
        return callback({})
      },
    },
  })
  setActiveLocalAccount("synthetic-account")
})

afterEach(() => {
  disposeAccountJournalRecords()
  setActiveLocalAccount(null)
  vi.clearAllMocks()
})

it("queues a post-click list read instead of reusing an older in-flight hydration", async () => {
  let finishOld!: () => void
  state.request
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = () => resolve(emptyList) }))
    .mockResolvedValueOnce(emptyList)

  const oldHydration = hydrateAccountJournalRecords()
  await vi.waitFor(() => expect(state.request).toHaveBeenCalledTimes(1))
  const fresh = refreshAccountJournalRecordsForExport()
  expect(state.request).toHaveBeenCalledTimes(1)
  finishOld()

  await expect(oldHydration).resolves.toBe(true)
  await expect(fresh).resolves.toBe(true)
  expect(state.request).toHaveBeenCalledTimes(2)
  expect(state.request.mock.calls[1]?.[1]).toMatchObject({ action: "list", collection: "JOURNAL" })
})

it("fails closed when the export-time list read fails", async () => {
  state.request.mockResolvedValueOnce({ ok: false, error: "UNAVAILABLE" })
  await expect(refreshAccountJournalRecordsForExport()).resolves.toBe(false)
})

it("ignores a late export-time response after an ABA account switch", async () => {
  let finish!: () => void
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(emptyList) }))
  const fresh = refreshAccountJournalRecordsForExport()
  await vi.waitFor(() => expect(state.request).toHaveBeenCalledTimes(1))
  setActiveLocalAccount("other-account")
  setActiveLocalAccount("synthetic-account")
  finish()
  await expect(fresh).resolves.toBe(false)
})

it("does not require a server read outside the enabled account-storage path", async () => {
  state.enabled = false
  await expect(refreshAccountJournalRecordsForExport()).resolves.toBe(true)
  expect(state.request).not.toHaveBeenCalled()
})
