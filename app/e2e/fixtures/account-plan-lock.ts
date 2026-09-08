import { createAccountPlanCollectionService } from "../../src/domain/account/account-plan-collection-service"
import type { AccountPlanCollectionClient } from "../../src/domain/account/account-plan-collection-api"

export function setup(hold: boolean) {
  let calls = 0, release = () => {}
  const pending = new Promise<void>(resolve => { release = resolve })
  const client: AccountPlanCollectionClient = {
    readIndex: async () => { calls++; if (hold) await pending; return null },
    readLegacy: async () => null, readPart: async () => null, receipt: async () => null,
    stage: async () => { throw Error("Unexpected write") },
    commit: async () => { throw Error("Unexpected commit") },
  }
  const service = createAccountPlanCollectionService({ ownerId: "11111111-1111-4111-8111-111111111111",
    isCurrent: () => true, client })
  window.accountLockHarness = { service, release, calls: () => calls }
}
declare global { interface Window { accountLockHarness: {
  service: ReturnType<typeof createAccountPlanCollectionService>; release: () => void; calls: () => number
} } }
