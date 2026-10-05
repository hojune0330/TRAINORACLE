import { beforeEach, expect, it, vi } from "vitest"
import { currentStorageConsentRevision, pinStorageOperationRevision, rememberStorageConsentRevision } from "./storage-consent-revision"
import { storageConsentSchema } from "./storage-consent"
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks()})
it("keeps operation pins owner-specific and immutable across withdrawal/regrant",()=>{
  rememberStorageConsentRevision("owner-a",1)
  expect(pinStorageOperationRevision("owner-a","operation")).toBe(1)
  rememberStorageConsentRevision("owner-a",3)
  expect(pinStorageOperationRevision("owner-a","operation")).toBe(1)
  expect(pinStorageOperationRevision("owner-a","new-operation")).toBe(3)
  expect(pinStorageOperationRevision("owner-b","operation")).toBe(0)
})
it("missing legacy jobs and unavailable persistence cannot acquire current authorization",()=>{
  rememberStorageConsentRevision("owner",3)
  expect(pinStorageOperationRevision("owner","legacy",0)).toBe(0)
  expect(pinStorageOperationRevision("owner","legacy")).toBe(0)
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("synthetic quota")})
  expect(pinStorageOperationRevision("owner","new-operation")).toBe(0)
  expect(currentStorageConsentRevision("unseen")).toBe(0)
})
it("does not accept a pre-erasure server receipt as proof of successful withdrawal",()=>{
  const old={userId:"a1111111-1111-4111-8111-111111111111",revision:2,purposeVersion:"2026-10-05",
    healthStorage:false,journalTextStorage:false,decidedAt:null,operationsReady:true}
  expect(storageConsentSchema.safeParse(old).success).toBe(false)
  expect(storageConsentSchema.safeParse({...old,liveErasedAt:"2026-10-05T00:00:00+00:00",backupStatus:"PENDING"}).success).toBe(true)
})
