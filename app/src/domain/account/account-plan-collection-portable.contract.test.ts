import { execFileSync } from "node:child_process"
import { expect, it } from "vitest"

it("keeps the deployed collection validator byte-identical to the reviewed source", () => {
  expect(() => execFileSync(process.execPath, ["scripts/build-account-plan-collection-validator.mjs", "--check"],
    { encoding: "utf8", timeout: 30_000 })).not.toThrow()
}, 35_000)
