import { vi } from "vitest"
import { accountPlanFingerprint } from "./account-plan-document-schema"
import type { AccountPlanCollectionPreparation, AccountPlanCollectionPreparationStore } from "./account-plan-collection-preparation"

// Protocol double only. Encryption and transaction atomicity require native IDB tests.
export function createCollectionPreparationMemory() {
  const rows = new Map<string, AccountPlanCollectionPreparation>()
  const check = (current: () => boolean) => { if (!current()) throw Error("STALE") }
  const buffer: AccountPlanCollectionPreparationStore = {
    read: vi.fn(async (owner, current) => { check(current); return structuredClone(rows.get(owner) ?? null) }),
    save: vi.fn(async (input, current) => {
      check(current)
      const captured = structuredClone(input), old = rows.get(captured.transfer.ownerId)
      if (old && accountPlanFingerprint(old) !== accountPlanFingerprint(captured)) throw Error("CONFLICT")
      rows.set(captured.transfer.ownerId, captured)
    }),
    clear: vi.fn(async (owner, operationId, current) => {
      check(current)
      const old = rows.get(owner)
      if (old && old.transfer.operationId !== operationId) throw Error("CONFLICT")
      rows.delete(owner)
    }),
    close: vi.fn(),
  }
  return { buffer, rows }
}
