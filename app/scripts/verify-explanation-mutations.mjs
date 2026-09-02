import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { spawnSync } from "node:child_process"

const root = resolve(import.meta.dirname, "..")
const test = "src/domain/session-explanation.contract.test.ts"
const receipt = "src/domain/training-explanation-receipt.ts"
const explanation = "src/domain/session-explanation.ts"
const content = "src/domain/session-explanation-content.ts"
const cases = [
  { id: "IGNORE_PLAN_BINDING", file: receipt, from: "&& parsed.data.planFingerprint === planFingerprint(plan)", to: "&& true", testName: "rejects a stale or altered plan explanation receipt" },
  { id: "IGNORE_CONTENT_VERSION", file: receipt, from: "&& parsed.data.contentFingerprint === contentFingerprint(plan)", to: "&& true", testName: "rejects a stale or altered content" },
  { id: "FABRICATED_HISTORICAL_REASON", file: explanation, from: "const originalExplanationAvailable = usableContext?.kind === \"CANDIDATE\"", to: "const originalExplanationAvailable = true || usableContext?.kind === \"CANDIDATE\"", testName: "keeps old plans readable" },
  { id: "HARDCODED_REPETITIONS", file: content, from: "총 ${p.totals.totalRepetitions}회, 본운동 거리", to: "총 99회, 본운동 거리", testName: "uses the exact prescription" },
  { id: "HARDCODED_RECOVERY", file: content, from: "${p.totals.repetitionRecoveryOccurrences}번 넣었어요.", to: "99번 넣었어요.", testName: "uses the exact prescription" },
  { id: "READ_UNRELATED_FREE_TEXT", file: receipt, from: "candidateId: plan.candidateId,", to: "...plan, candidateId: plan.candidateId, memo: plan.memo,", testName: "does not read injected free text" },
  { id: "REUSE_STALE_JOURNAL", file: "src/screens/plan-beta/SessionExplanation.tsx", from: "[loadEvidence, session, context?.plan.candidateId, context?.generatedAt]", to: "[]", testFile: "src/screens/plan-beta/SessionExplanation.contract.test.tsx", testName: "refreshes exact generation evidence" },
  { id: "IGNORE_JOURNAL_GENERATION", file: "src/screens/plan-beta/SessionExplanation.tsx", from: "&& evidence.generatedAt === context.generatedAt", to: "&& true", testFile: "src/screens/plan-beta/SessionExplanation.contract.test.tsx", testName: "refreshes exact generation evidence" },
  { id: "IGNORE_TEMPLATE_COMPOSITION", file: "src/domain/training-template-explanations.ts", from: "prescription[key] === entry.identity[key]", to: "prescription.templateId === entry.identity.templateId", testFile: "src/domain/training-template-explanations.contract.test.ts", testName: "does not reuse" },
  { id: "TREAT_RPE_ENVELOPE_AS_METHOD", file: "src/domain/plan-main-comparison.ts", from: "row.samePrescribedValues && row.methodRelation === \"SAME\"", to: "row.samePrescribedValues", testFile: "src/domain/plan-main-comparison.contract.test.ts", testName: "RPE envelopes can match as values" },
  { id: "IGNORE_CHANGED_PACE_TARGET", file: "src/domain/plan-main-comparison.ts", from: "p.targetRepSeconds, p.repetitionRecoverySeconds", to: "0, p.repetitionRecoverySeconds", testFile: "src/domain/plan-main-comparison.contract.test.ts", testName: "athlete pace changes dose" },
  { id: "HARDCODE_COMPARISON_RECOVERY", file: "src/domain/plan-main-comparison.ts", from: "${totals.repetitionRecoveryOccurrences}번", to: "99번", testFile: "src/domain/plan-main-comparison.contract.test.ts", testName: "compares every real" },
  { id: "IGNORE_COMPARISON_FRAME", file: "src/domain/plan-main-comparison.ts", from: "a.frame.lengthDays === b.frame.lengthDays && a.frame.projectionLengthDays === b.frame.projectionLengthDays", to: "true", testFile: "src/domain/plan-main-comparison.contract.test.ts", testName: "frame mismatch blocks" },
]
const hash = text => createHash("sha256").update(text).digest("hex")
const originals = new Map([...new Set(cases.map(item => item.file))].map(file => [file, readFileSync(resolve(root, file), "utf8")]))
const report = { runAt: new Date().toISOString(), scope: "synthetic fixtures only", cases: [], restored: false }
const directory = mkdtempSync(join(tmpdir(), "trainoracle-explanation-mutations-"))
try {
  for (const item of cases) {
    const original = originals.get(item.file)
    if (original.split(item.from).length !== 2) throw new Error(`Mutation target is not unique: ${item.id}`)
    const target = resolve(root, item.file)
    const resultFile = join(directory, `${item.id}.json`)
    writeFileSync(target, original.replace(item.from, item.to))
    let result
    try {
      result = spawnSync(process.execPath, [resolve(root, "node_modules/vitest/vitest.mjs"), "run", item.testFile ?? test, "--reporter=json", `--outputFile=${resultFile}`], { cwd: root, encoding: "utf8", timeout: 60_000 })
    } finally {
      writeFileSync(target, original)
    }
    if (result.status !== 1 || result.error) throw new Error(`Mutation did not fail as a test assertion: ${item.id}`)
    const execution = JSON.parse(readFileSync(resultFile, "utf8"))
    const failures = execution.testResults.flatMap(file => file.assertionResults).filter(item => item.status === "failed")
    if (!failures.some(failure => failure.fullName.includes(item.testName))) throw new Error(`Expected assertion was not exercised: ${item.id}`)
    report.cases.push({ id: item.id, caught: true, expectedFailure: item.testName, failedTestNames: failures.map(failure => failure.fullName), sourceSha256: hash(original) })
    rmSync(resultFile)
  }
} finally {
  for (const [file, original] of originals) writeFileSync(resolve(root, file), original)
  report.restored = [...originals].every(([file, original]) => hash(readFileSync(resolve(root, file), "utf8")) === hash(original))
}
if (!report.restored) throw new Error("Source restoration failed")
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report))
