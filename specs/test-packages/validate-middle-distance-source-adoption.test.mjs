import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = resolve(import.meta.dirname, "../..")
const packetPath = resolve(root, "reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md")
const validator = resolve(root, "specs/test-packages/validate-middle-distance-source-adoption.mjs")

function run(path = packetPath) {
  return spawnSync(process.execPath, [validator, path], { cwd: root, encoding: "utf8" })
}

async function mutate(from, to) {
  const dir = await mkdtemp(join(tmpdir(), "trainoracle-md-source-"))
  const path = join(dir, "packet.md")
  const original = await readFile(packetPath, "utf8")
  assert.ok(original.includes(from), `mutation target missing: ${from}`)
  await writeFile(path, original.replace(from, to), "utf8")
  const result = run(path)
  await rm(dir, { recursive: true, force: true })
  return result
}

test("accepted packet is complete but not runtime-active", () => {
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /3 source-accepted drafts, 0 runtime-active/u)
})

for (const fixture of [
  ["800 notation mutation", 'machineNotation: "10×200m @800m RP · r60″ STAND"', 'machineNotation: "9×200m @800m RP · r60″ STAND"', /MD-800-01 missing machineNotation/u],
  ["1500 recovery mutation", "repetitionRecoveryTotalSeconds: 360", "repetitionRecoveryTotalSeconds: 300", /MD-1500-01 missing repetitionRecoveryTotalSeconds/u],
  ["3000 distance mutation", "qualityDistanceM: 3200", "qualityDistanceM: 3000", /MD-3000-01 missing qualityDistanceM/u],
  ["runtime activation mutation", "lifecycleStatus: DRAFT", "lifecycleStatus: ACTIVE", /source adoption must not activate/u],
  ["age-dose mutation", "YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH", "YOUTH_AUTOMATIC_DOWNSCALE", /populationApplicability/u],
  ["final marker removal", "[DRAFT_COMPLETE]", "" , /final marker/u],
]) {
  test(fixture[0], async () => {
    const result = await mutate(fixture[1], fixture[2])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, fixture[3])
  })
}
