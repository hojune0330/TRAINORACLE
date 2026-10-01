import { readFileSync, writeFileSync } from "node:fs"

const receipts = ["UTC", "KST"].map(zone => {
  const source = `results-${zone}.json`
  const report = JSON.parse(readFileSync(new URL(`./${source}`, import.meta.url), "utf8"))
  const assertions = report.testResults.flatMap(file => file.assertionResults)
    .filter(assertion => / > O0[123] |\bO0[123]\b/.test(assertion.fullName))
    .map(({ fullName, status, duration }) => ({ fullName, status, duration }))
  if (assertions.length !== 3 || assertions.some(assertion => assertion.status !== "passed")) {
    throw Error(`Expected exactly three original pre-fix bug observations in ${source}`)
  }
  return { zone, source, sourceSnapshot: `snapshot-${zone}.json`, assertions }
})
writeFileSync(new URL("./observed-consequences-before-fix.json", import.meta.url), JSON.stringify({
  evidenceKind: "PRE_FIX_BUG_OBSERVATION_NOT_ACCEPTANCE",
  meaning: "These assertions prove the former defects existed. They are excluded from post-fix acceptance.",
  receipts,
}, null, 2))
