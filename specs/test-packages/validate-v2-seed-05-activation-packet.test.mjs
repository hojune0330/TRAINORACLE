import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateActivationPacket } from "./validate-v2-seed-05-activation-packet.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const historicalCommit = "04f7ddc260219bcff514f7f8c8dce2b97f2d9936"

async function inputs() {
  const packet = await readFile(resolve(root, "reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md"), "utf8")
  const historicalCatalog = execFileSync("git", ["show", `${historicalCommit}:specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`], { cwd: root, encoding: "utf8" })
  return { packet, historicalCatalog }
}

test("preserves the historical packet-time forbidden verdict after current activation", async () => {
  const result = validateActivationPacket(await inputs())
  assert.equal(result.activation, "FORBIDDEN_AT_PACKET_TIME")
  assert.equal(result.currentActivationAuthority, "SUPERSEDED_NOT_EVALUATED")
})

test("rejects any historical packet byte change", async () => {
  const value = await inputs()
  const packet = `${value.packet}\nextra`
  assert.notEqual(packet, value.packet)
  assert.throws(() => validateActivationPacket({ ...value, packet }), /review packet content changed/u)
})

test("rejects any pinned historical catalog byte change", async () => {
  const value = await inputs()
  const historicalCatalog = value.historicalCatalog.replace("lifecycleStatus: DRAFT", "lifecycleStatus: ACTIVE")
  assert.notEqual(historicalCatalog, value.historicalCatalog)
  assert.throws(() => validateActivationPacket({ ...value, historicalCatalog }), /historical detailed prescription catalog content changed/u)
})

test("accepts the same historical byte evidence with LF line endings", async () => {
  const value = await inputs()
  const lf = (text) => text.replace(/\r\n/g, "\n")
  assert.doesNotThrow(() => validateActivationPacket({ packet: lf(value.packet), historicalCatalog: lf(value.historicalCatalog) }))
})
