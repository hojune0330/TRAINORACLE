import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

const EXPECTED_PACKET_SHA256 = "f1aa080002178517f03a96c641c586ef49f99537df83505670695ecb88bb306b"
const EXPECTED_CATALOG_SHA256 = "32ddeff1bf6f3f9727ef8014eb667694131f85d8e5dfebf95d885d94af5e4f10"
const EXPECTED_APPROVALS_SHA256 = "bd7f70a488e1916f18ca9fce213202a7e770153057f61061996244a758c0bf90"

function sha256(value) {
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex")
}

export function validateActivationPacket({ packet, catalog, approvals }) {
  const hashes = Object.freeze({
    packet: sha256(packet),
    catalog: sha256(catalog),
    approvals: sha256(approvals),
  })
  invariant(hashes.packet === EXPECTED_PACKET_SHA256, "review packet content changed")
  invariant(hashes.catalog === EXPECTED_CATALOG_SHA256, "detailed prescription catalog content changed")
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
    `catalog_sha256=${result.hashes.catalog}`,
    `approvals_sha256=${result.hashes.approvals}`,
    "",
  ].join("\n"))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
