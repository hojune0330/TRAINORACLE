import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "../..")
const handoffPath = resolve(repoRoot, "reports/review/WO011_QUALIFIED_PRIVACY_REVIEW_HANDOFF.md")
const factsPath = resolve(repoRoot, "reports/review/WO011_PRODUCT_FACT_QUESTIONNAIRE.md")
const ownerDecisionPath = resolve(repoRoot, "reports/review/WO011_OWNER_PRODUCT_FACT_DECISION_01_LAUNCH_SCOPE_2026-07-20.md")

const failures = []

function read(path) {
  try {
    return readFileSync(path, "utf8")
  } catch (error) {
    failures.push(`missing or unreadable: ${path} (${error instanceof Error ? error.message : String(error)})`)
    return ""
  }
}

function requireText(text, label, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${label}: missing required text: ${needle}`)
  }
}

function forbidLine(text, label, lines) {
  const actualLines = new Set(text.split("\n").map((line) => line.trim()))
  for (const line of lines) {
    if (actualLines.has(line)) failures.push(`${label}: forbidden acceptance/runtime claim: ${line}`)
  }
}

const handoff = read(handoffPath)
const facts = read(factsPath)
const ownerDecision = read(ownerDecisionPath)

requireText(handoff, "handoff", [
  "legal_advice_status: NOT_LEGAL_ADVICE",
  "decision: NOT_ACCEPTED",
  "reviewer: UNASSIGNED",
  "runtime_authority: false",
  "## Product-Fact Intake Gate",
  "## Qualified Reviewer Decision Record",
  "PRIVATE_SELF_ONLY",
  "zero-signal",
  "OWNER_FULL_BACKUP",
  "in-app recipient sharing remains blocked",
  "ACCEPTED | REVISED | REJECTED",
])

requireText(facts, "questionnaire", [
  "legal_advice_status: NOT_LEGAL_ADVICE",
  "decision: NOT_ACCEPTED",
  "reviewer: UNASSIGNED",
  "runtime_authority: false",
  "allowed_response_states: [CONFIRMED, UNKNOWN, NOT_APPLICABLE, CONFLICTING_EVIDENCE]",
  "## A. Launch Countries And Ages",
  "## B. Controller And Processor Roles",
  "## C. Field And Inference Inventory",
  "## D. Purpose, Recipient, Vendor, And Region Matrix",
  "## E. Retention, Deletion, Backup, And Key Erasure",
  "## F. Legal Hold, Breach, And International Transfer",
  "## G. Source And Version Register",
  "## H. Owner Attestation",
  "PRIVATE_SELF_ONLY",
  "OWNER_FULL_BACKUP",
  "latest_owner_fact_update_base: a0a51096762a82f1cdf56b0eb522e72e870484c6",
  "owner_fact_batch_01: RECORDED_PENDING_QUALIFIED_REVIEW",
  "South Korea is the only included country for the first public launch",
  "The first public launch is local-journal-only",
])

requireText(ownerDecision, "owner decision", [
  "decision_id: TO-WO011-OWNER-PRODUCT-FACTS-01-2026-07-20",
  "record_status: OWNER_PRODUCT_FACT_BATCH_RECORDED_PENDING_QUALIFIED_REVIEW",
  "formal_privacy_acceptance: false",
  "public_launch_authorized: false",
  "runtime_authority: false",
  "owner_response: \"ㅇㅋ ㄱㄱ\"",
  "PF-LA-02",
  "PF-LA-03",
  "PF-LA-07",
])

const questionRows = facts.split("\n").filter((line) => /^\| PF-[A-Z]+-\d{2} \|/.test(line))
if (questionRows.length < 35) failures.push(`questionnaire: expected at least 35 product-fact rows, found ${questionRows.length}`)

const allowedStates = new Set(["CONFIRMED", "UNKNOWN", "NOT_APPLICABLE", "CONFLICTING_EVIDENCE"])
for (const row of questionRows) {
  const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean)
  const state = cells.at(-3)
  const evidence = cells.at(-2)
  const owner = cells.at(-1)
  if (!allowedStates.has(state)) failures.push(`questionnaire: invalid response state in row: ${row}`)
  if (!evidence) failures.push(`questionnaire: missing evidence/next action in row: ${row}`)
  if (!owner) failures.push(`questionnaire: missing fact owner in row: ${row}`)
  if (state === "UNKNOWN" && !evidence.startsWith("UNKNOWN -")) {
    failures.push(`questionnaire: UNKNOWN row must state an explicit next action: ${row}`)
  }
}

const expectedStates = new Map([
  ["PF-LA-01", "CONFIRMED"],
  ["PF-LA-04", "CONFIRMED"],
  ["PF-LA-05", "NOT_APPLICABLE"],
  ["PF-LA-06", "NOT_APPLICABLE"],
  ["PF-PR-01", "CONFIRMED"],
  ["PF-PR-09", "CONFIRMED"],
])
for (const [id, expectedState] of expectedStates) {
  const row = questionRows.find((candidate) => candidate.includes(`| ${id} |`))
  if (row === undefined || !row.includes(`| ${expectedState} |`)) {
    failures.push(`questionnaire: owner-decided fact ${id} must be ${expectedState}`)
  }
}

const requiredUnknowns = ["PF-LA-02", "PF-LA-03", "PF-LA-07", "PF-CP-01", "PF-RD-01", "PF-BT-01"]
for (const id of requiredUnknowns) {
  const row = questionRows.find((candidate) => candidate.includes(`| ${id} |`))
  if (row === undefined || !row.includes("| UNKNOWN |")) {
    failures.push(`questionnaire: launch/governance fact ${id} must remain explicit UNKNOWN until owner evidence exists`)
  }
}

forbidLine(`${handoff}\n${facts}`, "packet", [
  "decision: ACCEPTED",
  "reviewer: ASSIGNED",
  "runtime_authority: true",
  "formation_activation: true",
  "legal_advice_status: LEGAL_ADVICE",
])

if (failures.length > 0) {
  console.error(`WO011 qualified handoff validation: FAIL (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`WO011 qualified handoff validation: PASS (product_fact_rows=${questionRows.length})`)
}
