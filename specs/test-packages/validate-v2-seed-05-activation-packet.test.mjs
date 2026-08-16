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
