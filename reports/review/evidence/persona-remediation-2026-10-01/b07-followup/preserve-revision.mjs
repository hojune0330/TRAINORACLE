import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { createHash } from "node:crypto"

const root = new URL("../../", import.meta.url)
const here = new URL(".", import.meta.url)
const hash = value => createHash("sha256").update(value).digest("hex")
const before = JSON.parse(readFileSync(new URL("before-source-hashes.json", here), "utf8"))
const values = before.map(({ path }) => {
  const bytes = readFileSync(new URL(path, root))
  const target = new URL(`after-fix-source/${path}`, here)
  mkdirSync(new URL(".", target), { recursive: true })
  writeFileSync(target, bytes, { flag: "wx" })
  return { path, sha256: hash(bytes) }
})

const path = "app/src/screens/PlanBeta.tsx"
let original = readFileSync(new URL(path, root), "utf8")
const newline = original.includes("\r\n") ? "\r\n" : "\n"
const replace = (from, to) => {
  from = from.replaceAll("\n", newline)
  to = to.replaceAll("\n", newline)
  if (original.split(from).length !== 2) throw Error("Non-unique parent-fix preservation anchor")
  original = original.replace(from, to)
}
replace("  const pendingNextReceipt = React.useRef<Extract<PlanBetaState, { version: 3 }> | null>(null)\n", "")
replace(`    const pendingPredecessor = pendingNextReceipt.current
    if (pendingPredecessor === null || stored === null
        || JSON.stringify(stored) === JSON.stringify(pendingPredecessor)) return
    pendingNextReceipt.current = null
    if (nextPredecessor === null || JSON.stringify(nextPredecessor) !== JSON.stringify(pendingPredecessor)) return`,
`    if (errorCode !== "ACCOUNT_PLAN_PENDING" || nextPredecessor === null || stored === null
        || JSON.stringify(stored) === JSON.stringify(nextPredecessor)) return`)
replace("      case \"saved\":\n        pendingNextReceipt.current = null\n", "      case \"saved\":\n")
replace(`        if (result.code === "ACCOUNT_PLAN_PENDING" && nextPredecessor !== null) {
          pendingNextReceipt.current = nextPredecessor
        }
`, "")
const expected = before.find(row => row.path === path).sha256
if (hash(original) !== expected) throw Error(`Pre-fix reconstruction mismatch: ${hash(original)} != ${expected}`)
const preFix = new URL("before-fix-source/PlanBeta.tsx", here)
mkdirSync(new URL(".", preFix), { recursive: true })
writeFileSync(preFix, original, { flag: "wx" })
writeFileSync(new URL("after-fix-source-hashes.json", here), JSON.stringify(values, null, 2), { flag: "wx" })
console.log(JSON.stringify({ preservedBeforeFixSha256: expected, afterFix: values }, null, 2))
