import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

const EXPECTED_PACKET_SHA256 = "9aac6ef3cc08cbd087f5d724308a08a62d171af6c99c5cf09fe3e2ff71aa7983"
const EXPECTED_CATALOG_TEMPLATE_SHA256 = "c41704e7461b1d007dad4d5019de3cd680e4cfe15b9813c77f245c8eeced0b80"
const EXPECTED_APPROVALS_SHA256 = "b506b1098ffc29ade4536cc49d3f0ae0db66cc04cf7a1081dfb9b3c33e5d201c"

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

export function validateActivationPacket({ packet, catalog, approvals }) {
  const start = catalog.indexOf("- templateId: V2-SEED-05")
  const end = catalog.indexOf("```", start)
  invariant(start >= 0 && end > start, "V2-SEED-05 catalog block missing")
  const template = catalog.slice(start, end)
  const hashes = Object.freeze({
    packet: sha256(packet),
    catalogTemplate: sha256(template),
    approvals: sha256(approvals),
  })
  invariant(hashes.packet === EXPECTED_PACKET_SHA256, "review packet content changed")
  invariant(hashes.catalogTemplate === EXPECTED_CATALOG_TEMPLATE_SHA256, "V2-SEED-05 catalog content changed")
  invariant(hashes.approvals === EXPECTED_APPROVALS_SHA256, "runtime approval manifest content changed")
  return Object.freeze({ templateId: "V2-SEED-05", activation: "FORBIDDEN", hashes })
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const [packet, catalog, approvals] = await Promise.all([
    readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-approvals.ts"), "utf8"),
  ])
  const result = validateActivationPacket({ packet, catalog, approvals })
  process.stdout.write([
    `PASS ${result.templateId}: runtime activation ${result.activation}`,
    `packet_sha256=${result.hashes.packet}`,
    `catalog_template_sha256=${result.hashes.catalogTemplate}`,
    `approvals_sha256=${result.hashes.approvals}`,
    "",
  ].join("\n"))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
