import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll(value, required, label) {
  for (const item of required) {
    invariant(value.includes(item), `${label} missing: ${item}`)
  }
}

function scalar(value, key, label) {
  const match = value.match(new RegExp(`^${key}:\\s*([^\\r\\n]+)$`, "m"))
  invariant(match !== null, `${label} missing: ${key}`)
  return match[1].trim()
}

function pendingReviews(packet) {
  const match = packet.match(/## 6\. 사람 검토 기록[\s\S]*?```yaml\s*\r?\nreview_decisions:\s*\r?\n([\s\S]*?)```/)
  invariant(match !== null, "structured review decisions missing")
  const decisions = Object.fromEntries(
    match[1].split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => {
      const entry = line.match(/^\s{2}([a-z_]+):\s*([A-Z_]+)\s*$/)
      invariant(entry !== null, `invalid review decision line: ${line}`)
      return [entry[1], entry[2]]
    }),
  )
  const roles = ["owner_review", "coach_review", "sports_science_review", "youth_review"]
  invariant(Object.keys(decisions).length === roles.length, "review decisions must contain four roles only")
  for (const role of roles) invariant(decisions[role] === "PENDING", `${role} must remain PENDING`)
}

function emptyApprovalManifest(approvals) {
  const source = approvals
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
  const assignment = source.match(
    /export const DETAILED_PRESCRIPTION_APPROVALS:[^=]+\=\s*Object\.freeze\(\s*\[\s*\]\s*\)/g,
  )
  invariant(assignment?.length === 1, "runtime approval manifest must be one empty array assignment")
}

export function validateActivationPacket({ packet, catalog, approvals }) {
  const marker = "[DRAFT_COMPLETE]"
  invariant(packet.split(marker).length === 2, "packet must contain one completion marker")
  invariant(packet.trimEnd().endsWith(marker), "completion marker must be final")
  invariant(scalar(packet, "status", "packet") === "REVIEW_INPUT_PACKET_READY_RUNTIME_GATE_BLOCKED", "packet status changed")
  invariant(scalar(packet, "template_id", "packet") === "V2-SEED-05", "packet template changed")
  invariant(scalar(packet, "template_version", "packet") === '"0.1"', "packet version changed")
  invariant(scalar(packet, "runtime_activation", "packet") === "FORBIDDEN", "runtime activation must remain forbidden")
  invariant(scalar(packet, "approval_manifest_entries", "packet") === "0", "packet approval count must remain zero")
  pendingReviews(packet)
  includesAll(packet, [
    "approval_manifest_entries: 0",
    "BLOCK-WARMUP",
    "BLOCK-COOLDOWN",
    "BLOCK-RECOVERY-MODE",
    "BLOCK-MINOR-POLICY",
    "BLOCK-REVIEW-AUTHORITY",
    "BLOCK-COMPONENT-RESOLUTION",
    "BLOCK-AGE-AUTHORITY",
    "anchor_provenance_required:",
    "verification_state: [VERIFIED, SELF_REPORTED]",
    "`150 sec JOG`",
    "`REDUCE_REPETITIONS`, `RPE_ONLY_CONTROLLED`",
    "`STOP_IF_D9_BLOCKED_OR_UNKNOWN`, `STOP_IF_ANCHOR_EVENT_MISMATCH`, `STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING`",
  ], "packet")

  const start = catalog.indexOf("- templateId: V2-SEED-05")
  const end = catalog.indexOf("```", start)
  invariant(start >= 0 && end > start, "V2-SEED-05 catalog block missing")
  const template = catalog.slice(start, end)
  includesAll(template, [
    "lifecycleStatus: DRAFT",
    "eligibilityStatus: REVIEW_REQUIRED",
    "machineNotation: \"5×1000m @5000m RP · r150″\"",
    "allowedEventGroups: []",
    "allowedExperienceBands: []",
    "minorAllowed: false",
  ], "catalog template")
  emptyApprovalManifest(approvals)
  return Object.freeze({ templateId: "V2-SEED-05", activation: "FORBIDDEN" })
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const [packet, catalog, approvals] = await Promise.all([
    readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-approvals.ts"), "utf8"),
  ])
  const result = validateActivationPacket({ packet, catalog, approvals })
  process.stdout.write(`PASS ${result.templateId}: runtime activation ${result.activation}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
