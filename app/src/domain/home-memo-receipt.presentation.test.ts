import { afterEach, expect, it, vi } from "vitest"

const account = vi.hoisted(() => ({ enabled: false }))
vi.mock("./account/account-journal-record-service", () => ({ accountJournalRecordsEnabled: () => account.enabled }))
import { homeMemoReceiptStorageStatus } from "./home-memo-receipt"

afterEach(() => { account.enabled = false })
it("classifies confirmed local saves only while account storage is disabled", () => {
  expect(homeMemoReceiptStorageStatus({ syncState: "local" })).toBe("LOCAL")
  expect(homeMemoReceiptStorageStatus({ syncState: "synced" })).toBe("UNKNOWN")
})
it("keeps unacknowledged account writes unknown and recognizes only synced saves", () => {
  account.enabled = true
  expect(homeMemoReceiptStorageStatus({ syncState: "local" })).toBe("UNKNOWN")
  expect(homeMemoReceiptStorageStatus({ syncState: "synced" })).toBe("ACCOUNT")
})
