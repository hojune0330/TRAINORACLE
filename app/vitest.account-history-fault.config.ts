import { defineConfig } from "vitest/config"
import base from "./vitest.config"

const mode = process.env.ACCOUNT_HISTORY_FAULT
if (mode !== "fingerprint" && mode !== "cancel") throw Error("Explicit history fault mode required")
let injected = false
export default defineConfig({
  ...base,
  plugins: [...(base.plugins ?? []), {
    name: "account-history-fault-probe", enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/account-plan-collection-service.ts")) return
      const needle = mode === "fingerprint"
        ? 'if (accountPlanCollectionPartHash(document) !== target.documentFingerprint) throw Error("INVALID")'
        : "if (epoch !== historyEpoch) return false"
      if (!code.includes(needle)) throw Error("Fault target missing; not a successful rejection")
      injected = true
      let changed = code.replaceAll(needle, "/* deliberate test-only fault */")
      if (mode === "cancel") {
        const abort = "historyController?.abort(); historyController = null"
        if (!changed.includes(abort)) throw Error("Abort fault target missing")
        changed = changed.replaceAll(abort, "/* deliberate test-only abort fault */")
      }
      return { code: changed, map: null }
    },
    buildEnd() { if (!injected) throw Error("Fault was not injected") },
  }],
  test: { ...base.test, include: ["src/domain/account/account-plan-collection-service.contract.test.ts"], maxWorkers: 1 },
})
