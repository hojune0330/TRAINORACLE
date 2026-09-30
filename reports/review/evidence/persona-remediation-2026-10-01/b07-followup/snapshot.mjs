import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
const paths = ["app/src/screens/PlanBeta.tsx", "app/src/screens/plan-beta/PlanActiveState.tsx",
  "app/src/screens/plan-beta/plan-selection.ts", "app/src/domain/plan-beta-flow.ts", "app/src/domain/plan-beta-store.ts"]
const phase = process.argv[2]
if (!/^(before|after)$/.test(phase)) throw Error("Invalid phase")
const values = paths.map(path => ({ path, sha256: createHash("sha256")
  .update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest("hex") }))
writeFileSync(new URL(`${phase}-source-hashes.json`, import.meta.url), JSON.stringify(values, null, 2))
console.log(JSON.stringify(values, null, 2))
