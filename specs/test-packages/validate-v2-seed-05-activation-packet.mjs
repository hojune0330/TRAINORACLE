import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

const EXPECTED_PACKET_SHA256 = "f1aa080002178517f03a96c641c586ef49f99537df83505670695ecb88bb306b"
const EXPECTED_CATALOG_SHA256 = "32ddeff1bf6f3f9727ef8014eb667694131f85d8e5dfebf95d885d94af5e4f10"
const PACKET_RECORDED_APPROVALS_SHA256 = "bd7f70a488e1916f18ca9fce213202a7e770153057f61061996244a758c0bf90"

function sha256(value) {
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex")
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseManifest(manifest) {
  let parsed
  try {
    parsed = JSON.parse(manifest)
  } catch {
    throw new Error("runtime approval manifest must be valid JSON")
  }
  invariant(isObject(parsed), "runtime approval manifest must be an object")
  invariant(parsed.schemaVersion === 1, "runtime approval manifest schemaVersion must be 1")
  invariant(Array.isArray(parsed.trustedReviewerAuthorities), "trustedReviewerAuthorities must be an array")
  invariant(Array.isArray(parsed.approvals), "runtime approval manifest approvals must be an array")
  return parsed
}

function validateManifestAuthority(manifest) {
  const parsed = parseManifest(manifest)
  const activeV2 = parsed.approvals.some((approval) => (
    isObject(approval)
    && approval.templateId === "V2-SEED-05"
    && approval.lifecycleStatus === "ACTIVE"
    && approval.eligibilityStatus === "ELIGIBLE"
  ))
  invariant(!activeV2, "V2-SEED-05 is ACTIVE and ELIGIBLE in runtime manifest")
  return parsed.approvals.length === 0 ? "EMPTY" : "NO_ACTIVE_V2_SEED_05"
}

export function validateActivationPacket({ packet, catalog, manifest }) {
  const hashes = Object.freeze({
    packet: sha256(packet),
    catalog: sha256(catalog),
    manifestCurrent: sha256(manifest),
    approvalsPacketRecorded: PACKET_RECORDED_APPROVALS_SHA256,
  })
  invariant(hashes.packet === EXPECTED_PACKET_SHA256, "review packet content changed")
  invariant(hashes.catalog === EXPECTED_CATALOG_SHA256, "detailed prescription catalog content changed")
  return Object.freeze({
    templateId: "V2-SEED-05",
    activation: "FORBIDDEN",
    manifestAuthority: validateManifestAuthority(manifest),
    hashes,
  })
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const [packet, catalog, manifest] = await Promise.all([
    readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-manifest.json"), "utf8"),
  ])
  const result = validateActivationPacket({ packet, catalog, manifest })
  process.stdout.write([
    `PASS ${result.templateId}: runtime activation ${result.activation}`,
    `manifest_authority=${result.manifestAuthority}`,
    `packet_sha256=${result.hashes.packet}`,
    `catalog_sha256=${result.hashes.catalog}`,
    `packet_recorded_approvals_sha256=${result.hashes.approvalsPacketRecorded}`,
    `manifest_current_sha256=${result.hashes.manifestCurrent}`,
    "",
  ].join("\n"))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
