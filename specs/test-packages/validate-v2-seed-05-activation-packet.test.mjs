import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { validateActivationPacket } from "./validate-v2-seed-05-activation-packet.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

async function inputs() {
  const [packet, catalog, approvals] = await Promise.all([
    readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-approvals.ts"), "utf8"),
  ])
  return { packet, catalog, approvals }
}

test("accepts the pending review packet while runtime authority remains closed", async () => {
  const value = await inputs()
  assert.doesNotThrow(() => validateActivationPacket(value))
})

test("rejects a packet with content after the completion marker", async () => {
  const value = await inputs()
  assert.throws(() => validateActivationPacket({
    ...value,
    packet: `${value.packet}\nextra`,
  }))
})

test("rejects catalog activation before the review decisions exist", async () => {
  const value = await inputs()
  const activated = value.catalog.replace(
    /(- templateId: V2-SEED-05[\s\S]*?lifecycleStatus:) DRAFT/,
    "$1 ACTIVE",
  )
  assert.notEqual(activated, value.catalog)
  assert.throws(() => validateActivationPacket({
    ...value,
    catalog: activated,
  }))
})

test("rejects a nonempty runtime approval manifest", async () => {
  const value = await inputs()
  assert.throws(() => validateActivationPacket({
    ...value,
    approvals: value.approvals.replace("Object.freeze([])", "Object.freeze([{ templateId: \"V2-SEED-05\" }])"),
  }))
})

test("rejects a nonempty manifest even when an empty manifest appears in a comment", async () => {
  const value = await inputs()
  const approvals = value.approvals.replace(
    "Object.freeze([])",
    "/* Object.freeze([]) */ Object.freeze([{ templateId: \"V2-SEED-05\" }])",
  )
  assert.notEqual(approvals, value.approvals)
  assert.throws(() => validateActivationPacket({ ...value, approvals }))
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

test("rejects a nonempty manifest hidden behind an empty-assignment string literal", async () => {
  const value = await inputs()
  const approvals = value.approvals.replace(
    "Object.freeze([])",
    "\"export const DETAILED_PRESCRIPTION_APPROVALS: never = Object.freeze([])\"; Object.freeze([{ templateId: \"V2-SEED-05\" }])",
  )
  assert.notEqual(approvals, value.approvals)
  assert.throws(() => validateActivationPacket({ ...value, approvals }))
})
