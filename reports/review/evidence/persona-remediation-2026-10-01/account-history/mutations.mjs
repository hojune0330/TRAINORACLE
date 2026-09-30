import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, "../..")
const runner = resolve(root, ".scratch/b06-cycle-lineage-20261001/run.mjs")
const rows = [
  ["historyLoad", "src/hooks/usePlanEvidenceHistory.contract.test.tsx", "loads exact originals on demand without writing plans or browser storage"],
  ["historyRetry", "src/hooks/usePlanEvidenceHistory.contract.test.tsx", "an eventless guest retry refreshes the real reader evidence and preserves scroll"],
  ["journalArrival", "src/hooks/usePlanEvidenceHistory.contract.test.tsx", "late account journals update the open cycle without a second click and never claim an empty completed read"],
  ["stablePlan", "src/screens/plan-beta/plan-evidence-account.contract.test.tsx", "real account history progress does not close an open cycle review; actual plan changes still invalidate it"],
  ["unreadBookmark", "src/screens/OracleExplore.contract.test.tsx", "does not show or mark an unfinished personal comparison as read, then reveals the confirmed result"],
]
const results = []
for (const [mutation, file, test] of rows) {
  const run = `history-mutation-${mutation}`
  const proc = spawnSync(process.execPath, [runner, file], { cwd: root, encoding: "utf8", timeout: 120000,
    env: { ...process.env, TZ: "UTC", B06_MUTATION: mutation, B06_RUN: run, B06_TEST_NAME: test } })
  writeFileSync(resolve(here, `${run}.log`), `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`)
  const report = JSON.parse(readFileSync(resolve(dirname(runner), `${run}.json`), "utf8"))
  const failures = report.testResults.flatMap(result => result.assertionResults).filter(result => result.status === "failed").map(result => result.title)
  const detected = proc.status !== 0 && failures.includes(test) && report.numFailedTests > 0
  results.push({ mutation, file, expectedTest: test, exitCode: proc.status, failures, detected })
  console.log(JSON.stringify(results.at(-1)))
  if (!detected) { process.exitCode = 1; break }
}
writeFileSync(resolve(here, "mutations-result.json"), JSON.stringify({ method: "exact-once in-memory source transform; product files unchanged", results }, null, 2))
