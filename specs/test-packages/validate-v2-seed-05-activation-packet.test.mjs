import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateActivationPacket } from "./validate-v2-seed-05-activation-packet.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

async function inputs() {
  const [packet, catalog, manifest] = await Promise.all([
    readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-manifest.json"), "utf8"),
  ])
  return { packet, catalog, manifest }
}

function manifestWithApproval(manifest, approval) {
  const parsed = JSON.parse(manifest)
  assert.ok(Array.isArray(parsed.approvals))
  const mutated = JSON.stringify({ ...parsed, approvals: [...parsed.approvals, approval] })
  assert.notEqual(mutated, manifest)
  return mutated
}

test("accepts the pending review packet while runtime authority remains closed", async () => {
  const value = await inputs()
  assert.doesNotThrow(() => validateActivationPacket(value))
})

test("rejects a packet with content after the completion marker", async () => {
  const value = await inputs()
  assert.throws(() => validateActivationPacket({ ...value, packet: `${value.packet}\nextra` }))
})

test("rejects catalog activation before the review decisions exist", async () => {
  const value = await inputs()
  const catalog = value.catalog.replace(
    /(- templateId: V2-SEED-05[\s\S]*?lifecycleStatus:) DRAFT/,
    "$1 ACTIVE",
  )
  assert.notEqual(catalog, value.catalog)
  assert.throws(() => validateActivationPacket({ ...value, catalog }))
})

test("rejects a parsed ACTIVE and ELIGIBLE V2-SEED-05 manifest entry", async () => {
  const value = await inputs()
  const manifest = manifestWithApproval(value.manifest, {
    templateId: "V2-SEED-05",
    lifecycleStatus: "ACTIVE",
    eligibilityStatus: "ELIGIBLE",
  })
  assert.throws(
    () => validateActivationPacket({ ...value, manifest }),
    /V2-SEED-05 is ACTIVE and ELIGIBLE in runtime manifest/,
  )
})

test("rejects executable template ID concatenation because the manifest is JSON", async () => {
  const value = await inputs()
  const executableExpression = "{\"schemaVersion\":1,\"trustedReviewerAuthorities\":[],\"approvals\":[{\"templateId\":\"V2-SEED-\" + \"05\",\"lifecycleStatus\":\"ACTIVE\",\"eligibilityStatus\":\"ELIGIBLE\"}]}"
  assert.notEqual(executableExpression, value.manifest)
  assert.throws(() => JSON.parse(executableExpression), SyntaxError)
  assert.throws(
    () => validateActivationPacket({ ...value, manifest: executableExpression }),
    /runtime approval manifest must be valid JSON/,
  )
})

test("accepts an evolving parsed manifest with no active V2-SEED-05 entry", async () => {
  const value = await inputs()
  const manifest = manifestWithApproval(value.manifest, {
    templateId: "SYNTHETIC-NON-V2",
    lifecycleStatus: "ACTIVE",
    eligibilityStatus: "ELIGIBLE",
  })
  assert.doesNotThrow(() => validateActivationPacket({ ...value, manifest }))
})

test("rejects malformed manifest boundary shape", async () => {
  const value = await inputs()
  const parsed = JSON.parse(value.manifest)
  const manifest = JSON.stringify({ ...parsed, approvals: {} })
  assert.notEqual(manifest, value.manifest)
  assert.throws(
    () => validateActivationPacket({ ...value, manifest }),
    /runtime approval manifest approvals must be an array/,
  )
})

test("rejects an approved review even when PENDING appears in a comment", async () => {
  const value = await inputs()
  const packet = value.packet.replace(
    "  owner_review: PENDING",
    "  owner_review: APPROVED\n<!-- owner_review: PENDING -->",
  )
  assert.notEqual(packet, value.packet)
  assert.throws(() => validateActivationPacket({ ...value, packet }))
})

test("rejects a real approved review hidden behind a full commented PENDING section", async () => {
  const value = await inputs()
  const decoy = "<!-- ## 6. 사람 검토 기록\n```yaml\nreview_decisions:\n  owner_review: PENDING\n  coach_review: PENDING\n  sports_science_review: PENDING\n  youth_review: PENDING\n```\n-->\n"
  const packet = `${decoy}${value.packet.replace("  owner_review: PENDING", "  owner_review: APPROVED")}`
  assert.throws(() => validateActivationPacket({ ...value, packet }))
})

test("rejects an active catalog duplicate even when the reviewed draft remains", async () => {
  const value = await inputs()
  const catalog = `${value.catalog}\n- templateId: V2-SEED-05\n  lifecycleStatus: ACTIVE\n  eligibilityStatus: ELIGIBLE\n`
  assert.throws(() => validateActivationPacket({ ...value, catalog }))
})

test("accepts the same reviewed artifacts with LF line endings", async () => {
  const value = await inputs()
  const lf = (text) => text.replace(/\r\n/g, "\n")
  assert.doesNotThrow(() => validateActivationPacket({
    packet: lf(value.packet),
    catalog: lf(value.catalog),
    manifest: lf(value.manifest),
  }))
})
