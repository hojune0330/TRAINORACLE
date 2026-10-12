import { beforeEach, expect, it, vi } from "vitest"
import { isAccountStoragePaused, loadAccountStorageConsent, saveAccountStorageConsent, type StorageConsent } from "./storage-consent"
import { closeAccountDeletionBoundary } from "./account-deletion-boundary"
import { currentStorageConsentRevision, pinStorageOperationRevision, rememberStorageConsentRevision } from "./storage-consent-revision"

const { client } = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: client }))
vi.mock("./verified-auth-session", () => ({ verifyReturnedAuthSession: vi.fn().mockResolvedValue("synthetic-session") }))
beforeEach(() => { localStorage.clear(); client.mockReset() })
const consent = (userId: string, revision = 3): StorageConsent => ({ userId, revision, purposeVersion: "2026-10-05",
  healthStorage: true, journalTextStorage: true, decidedAt: null, operationsReady: true, liveErasedAt: null, backupStatus: null })
const instant = "2026-10-07T00:00:00.000Z"

it("forgets only the current consent grant and keeps immutable old operation pins after deletion", () => {
  const owner = "consent-cache-deleted", other = "consent-cache-other"
  rememberStorageConsentRevision(owner, 3)
  rememberStorageConsentRevision(other, 7)
  expect(pinStorageOperationRevision(owner, "fixed-operation")).toBe(3)
  closeAccountDeletionBoundary(owner, instant)
  expect(localStorage.getItem("trainoracle.storage-consent-revision.v1:" + owner)).toBeNull()
  expect(pinStorageOperationRevision(owner, "fixed-operation")).toBe(3)
  rememberStorageConsentRevision(owner, 9)
  expect(currentStorageConsentRevision(owner)).toBe(0)
  expect(currentStorageConsentRevision(other)).toBe(7)
  expect(isAccountStoragePaused(owner)).toBe(true)
  expect(isAccountStoragePaused(null)).toBe(false)
})

it("discards a delayed consent load after successful deletion and does not reopen transmission", async () => {
  const owner = "a6111111-1111-4111-8111-111111111111"
  let resolve!: (value: unknown) => void
  const rpc = vi.fn(() => new Promise(done => { resolve = done }))
  client.mockResolvedValue({ rpc })
  const loading = loadAccountStorageConsent(owner)
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledOnce())
  closeAccountDeletionBoundary(owner, instant)
  resolve({ data: consent(owner), error: null })
  expect(await loading).toMatchObject({ ok: false })
  expect(isAccountStoragePaused(owner)).toBe(true)
  expect(currentStorageConsentRevision(owner)).toBe(0)
})

it("discards a delayed regrant receipt and preserves the deletion terminal hold", async () => {
  const owner = "a6222222-2222-4222-8222-222222222222"
  let resolve!: (value: unknown) => void
  const rpc = vi.fn(() => new Promise(done => { resolve = done }))
  client.mockResolvedValue({ rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {
    user: { id: owner }, access_token: "synthetic-noncredential" } }, error: null }) } })
  const saving = saveAccountStorageConsent(consent(owner), true, true)
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledOnce())
  closeAccountDeletionBoundary(owner, instant)
  resolve({ data: consent(owner, 4), error: null })
  expect(await saving).toMatchObject({ ok: false })
  expect(isAccountStoragePaused(owner)).toBe(true)
  expect(currentStorageConsentRevision(owner)).toBe(0)
})

it("still loads a normal user's valid consent and leaves the guest unpaused", async () => {
  const owner = "a6333333-3333-4333-8333-333333333333"
  const value = consent(owner)
  client.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: value, error: null }) })
  expect(await loadAccountStorageConsent(owner)).toEqual({ ok: true, consent: value })
  expect(isAccountStoragePaused(owner)).toBe(false)
  expect(currentStorageConsentRevision(owner)).toBe(3)
  expect(isAccountStoragePaused(null)).toBe(false)
})

it("holds only account transmission when marker storage cannot be checked and never claims a deletion", async () => {
  const owner = "a6444444-4444-4444-8444-444444444444"
  const rpc = vi.fn().mockResolvedValue({ data: consent(owner), error: null })
  client.mockResolvedValue({ rpc })
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("synthetic unavailable") })
  expect(isAccountStoragePaused(owner)).toBe(true)
  expect(isAccountStoragePaused(null)).toBe(false)
  const loaded = await loadAccountStorageConsent(owner)
  expect(loaded).toMatchObject({ ok: false })
  if (!loaded.ok) expect(loaded.message).not.toContain("삭제를 요청")
  expect(rpc).not.toHaveBeenCalled()
  read.mockRestore()
  expect(await loadAccountStorageConsent(owner)).toMatchObject({ ok: true })
  expect(isAccountStoragePaused(owner)).toBe(false)
})
