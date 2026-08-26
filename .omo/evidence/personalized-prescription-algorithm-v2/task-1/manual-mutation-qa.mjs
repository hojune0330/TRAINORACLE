import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, renameSync, rmSync, realpathSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const temp = mkdtempSync(join(tmpdir(), "trainoracle-pv2-t1-"))
const safeTempRoot = realpathSync(tmpdir())
if (!realpathSync(temp).startsWith(safeTempRoot)) throw new Error("unsafe temporary path")

const paths = [
  "reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json",
  "reports/review/RACE_DATE_RETENTION_AUTHORITY.json",
  "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md",
  "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
]

function copy(path) {
  const destination = join(temp, path)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(resolve(root, path), destination)
}

function replaceOnce(path, target, replacement) {
  const absolute = join(temp, path)
  const source = readFileSync(absolute, "utf8")
  const count = source.split(target).length - 1
  if (count < 1) throw new Error(`mutation target absent: ${target}`)
  writeFileSync(absolute, source.replace(target, replacement), "utf8")
  return count
}

function probe(name) {
  const result = spawnSync(process.execPath, [
    "specs/test-packages/validate-personalized-prescription-v2-authority.mjs",
    `--artifact-root=${temp}`,
  ], { cwd: root, encoding: "utf8" })
  process.stdout.write(`${JSON.stringify({ probe: name, exitCode: result.status, stderr: result.stderr.trim() })}\n`)
  if (result.status !== 1) throw new Error(`${name} did not fail closed`)
}

try {
  paths.forEach(copy)

  const tokenCount = replaceOnce(paths[0], '"token": "1A"', '"token": "1B"')
  process.stdout.write(`${JSON.stringify({ probe: "approved-token-target", targetCount: tokenCount })}\n`)
  probe("approved-token")
  copy(paths[0])

  const recordedAtCount = replaceOnce(paths[0], '"recordedAt": "2026-08-23T03:32:21+09:00"', '"recordedAt": "2026-08-23T23:59:59+09:00"')
  process.stdout.write(`${JSON.stringify({ probe: "recorded-at-target", targetCount: recordedAtCount })}\n`)
  probe("recorded-at-provenance")
  copy(paths[0])

  writeFileSync(join(temp, paths[2]), `${readFileSync(join(temp, paths[2]), "utf8")}\nTRAILING_TEXT\n`, "utf8")
  probe("final-marker-tail")
  copy(paths[2])

  const classificationCount = replaceOnce(paths[2], '"classification": "ALREADY_SPEC_BOUND"', '"classification": "CANONICAL_PROMOTION_BLOCKED"')
  process.stdout.write(`${JSON.stringify({ probe: "classification-target", targetCount: classificationCount })}\n`)
  probe("audit-classification")
  copy(paths[2])

  const evidencePathCount = replaceOnce(
    paths[2],
    '"path": "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md"',
    '"path": "README.md"',
  )
  process.stdout.write(`${JSON.stringify({ probe: "audit-evidence-path-target", targetCount: evidencePathCount })}\n`)
  probe("audit-unrelated-evidence-path")
  copy(paths[2])

  const disclaimerCount = replaceOnce(
    paths[2],
    "This audit classifies current evidence and working-spec gaps. It does not promote a\ncanonical specification, close an OPEN issue, or turn research and implementation\nreceipts into runtime authority.",
    "This audit classifies current evidence and working-spec gaps. It promotes a\ncanonical specification, closes an OPEN issue, and turns research and implementation\nreceipts into runtime authority.",
  )
  process.stdout.write(`${JSON.stringify({ probe: "audit-disclaimer-target", targetCount: disclaimerCount })}\n`)
  probe("audit-disclaimer-contradiction")
  copy(paths[2])

  const appendedClaimCount = replaceOnce(
    paths[2],
    "[DRAFT_COMPLETE]",
    "Canonical promotion is approved; OPEN issues are closed; runtime authority is granted.\n\n[DRAFT_COMPLETE]",
  )
  process.stdout.write(`${JSON.stringify({ probe: "audit-appended-claim-target", targetCount: appendedClaimCount })}\n`)
  probe("audit-appended-authority-claim")
  copy(paths[2])

  const auditStatusCount = replaceOnce(paths[2], "Status: NON_CANONICAL_AUDIT", "Status: CANONICAL_PROMOTION_APPROVED")
  process.stdout.write(`${JSON.stringify({ probe: "audit-human-status-target", targetCount: auditStatusCount })}\n`)
  probe("audit-human-status")
  copy(paths[2])

  writeFileSync(join(temp, paths[1]), "{ malformed", "utf8")
  probe("malformed-json")
  copy(paths[1])

  const staleCount = replaceOnce(paths[3], "5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa", "0000000000000000000000000000000000000000")
  process.stdout.write(`${JSON.stringify({ probe: "stale-main-target", targetCount: staleCount })}\n`)
  probe("stale-main")
  copy(paths[3])

  for (const [name, target, replacement] of [
    ["deployment-receipt-path", '"receiptPath": "origin/gh-pages:trainoracle-deploy-receipt.json"', '"receiptPath": "README.md"'],
    ["deployment-pages-commit", '"pagesCommit": "066f83a890759bab0c8f5ea3dd13272aa9f5217c"', '"pagesCommit": "0000000000000000000000000000000000000000"'],
    ["deployment-proof-boundary", '"proofBoundary": "LOCAL_ORIGIN_GH_PAGES_REF_AND_EXACT_RECEIPT_NO_LIVE_FETCH"', '"proofBoundary": "LIVE_PUBLIC_SITE_FETCH_VERIFIED"'],
    ["deployment-workflow-run", '"workflowRunId": "32254051649"', '"workflowRunId": "00000000000"'],
    ["deployment-timestamp", '"deployedAt": "2026-08-19T12:54:07.499Z"', '"deployedAt": "2026-08-20T12:54:07.499Z"'],
    ["deployment-workflow-missing", '    "workflowRunId": "32254051649",\n', ""],
    ["deployment-extra-claim", '"liveFetchPerformed": false\n', '"liveFetchPerformed": false,\n    "publicSiteFetchVerified": true\n'],
    ["todo-1-ownership-substitution", '"reports/review/RACE_DATE_RETENTION_AUTHORITY.json"', '"README.md"'],
    ["active-template-count", '"activeDetailedTemplateCount": 4', '"activeDetailedTemplateCount": 5'],
    ["reverse-runtime-edge", '"reverseAdaptationEdgeState": "APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE"', '"reverseAdaptationEdgeState": "ACTIVE_BASELINE"'],
    ["handoff-human-status", "Status: TODO_1_PREPARED", "Status: PRODUCTION_RUNTIME_ACTIVE_AND_DEPLOYED"],
  ]) {
    const targetCount = replaceOnce(paths[3], target, replacement)
    process.stdout.write(`${JSON.stringify({ probe: `${name}-target`, targetCount })}\n`)
    probe(name)
    copy(paths[3])
  }

  renameSync(join(temp, paths[1]), join(temp, "retention.missing"))
  probe("missing-source")
  renameSync(join(temp, "retention.missing"), join(temp, paths[1]))

  const absentTarget = '"token": "1Z"'
  const absentCount = readFileSync(join(temp, paths[0]), "utf8").split(absentTarget).length - 1
  process.stdout.write(`${JSON.stringify({ probe: "target-absent", targetCount: absentCount, validatorInvoked: false, guardExit: 1 })}\n`)
  if (absentCount !== 0) throw new Error("target-absent control is invalid")

  replaceOnce(paths[0], '"token": "1A"', '"token": "1B"')
  process.stdout.write("PASS_BEFORE_VALIDATION\n")
  probe("misleading-success-output")
} finally {
  rmSync(temp, { recursive: true, force: true })
  process.stdout.write(`${JSON.stringify({ cleanup: "TEMP_MUTATION_COPY_REMOVED", tempExists: existsSync(temp), serversStarted: 0, portsOpened: 0 })}\n`)
}
