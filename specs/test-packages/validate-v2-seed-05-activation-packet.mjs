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

export function validateActivationPacket({ packet, catalog, approvals }) {
  const marker = "[DRAFT_COMPLETE]"
  invariant(packet.split(marker).length === 2, "packet must contain one completion marker")
  invariant(packet.trimEnd().endsWith(marker), "completion marker must be final")
  includesAll(packet, [
    "status: HUMAN_REVIEW_PACKET_READY",
    "template_id: V2-SEED-05",
    "runtime_activation: FORBIDDEN",
    "approval_manifest_entries: 0",
    "owner_review: PENDING",
    "coach_review: PENDING",
    "sports_science_review: PENDING",
    "youth_review: PENDING",
    "BLOCK-WARMUP",
    "BLOCK-COOLDOWN",
    "BLOCK-RECOVERY-MODE",
    "BLOCK-MINOR-POLICY",
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
  invariant(
    approvals.includes("Object.freeze([])"),
    "runtime approval manifest must remain empty",
  )
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
