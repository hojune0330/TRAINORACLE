import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HISTORICAL_CATALOG_COMMIT = "04f7ddc260219bcff514f7f8c8dce2b97f2d9936"
const EXPECTED_PACKET_SHA256 = "f1aa080002178517f03a96c641c586ef49f99537df83505670695ecb88bb306b"
const EXPECTED_CATALOG_SHA256 = "32ddeff1bf6f3f9727ef8014eb667694131f85d8e5dfebf95d885d94af5e4f10"
const PACKET_RECORDED_APPROVALS_SHA256 = "bd7f70a488e1916f18ca9fce213202a7e770153057f61061996244a758c0bf90"

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex")
}

export function validateActivationPacket({ packet, historicalCatalog }) {
  const hashes = Object.freeze({
    packet: sha256(packet),
    historicalCatalog: sha256(historicalCatalog),
    approvalsPacketRecorded: PACKET_RECORDED_APPROVALS_SHA256,
  })
  invariant(hashes.packet === EXPECTED_PACKET_SHA256, "review packet content changed")
  invariant(hashes.historicalCatalog === EXPECTED_CATALOG_SHA256, "historical detailed prescription catalog content changed")
  return Object.freeze({
    templateId: "V2-SEED-05",
    activation: "FORBIDDEN_AT_PACKET_TIME",
    currentActivationAuthority: "SUPERSEDED_NOT_EVALUATED",
    historicalCatalogCommit: HISTORICAL_CATALOG_COMMIT,
    hashes,
  })
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const packet = await readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8")
  const historicalCatalog = execFileSync("git", ["show", `${HISTORICAL_CATALOG_COMMIT}:specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`], { cwd: root, encoding: "utf8" })
  const result = validateActivationPacket({ packet, historicalCatalog })
  process.stdout.write([
    `PASS ${result.templateId}: historical runtime activation ${result.activation}`,
    `current_activation_authority=${result.currentActivationAuthority}`,
    `historical_catalog_commit=${result.historicalCatalogCommit}`,
    `packet_sha256=${result.hashes.packet}`,
    `historical_catalog_sha256=${result.hashes.historicalCatalog}`,
    `packet_recorded_approvals_sha256=${result.hashes.approvalsPacketRecorded}`,
    "",
  ].join("\n"))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
