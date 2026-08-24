import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import {
  REGISTRY_PATH,
  validateRacePlacementAuthority,
} from "./validate-personalized-prescription-v2-race-placement.mjs"

const root = resolve(import.meta.dirname, "../..")

function withMutation(mutate, run) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "trainoracle-race-placement-"))
  try {
    const registry = JSON.parse(readFileSync(resolve(root, REGISTRY_PATH), "utf8"))
    mutate(registry)
    const output = resolve(temporaryRoot, REGISTRY_PATH)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, `${JSON.stringify(registry, null, 2)}\n`)
    run(temporaryRoot)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

test("accepts the exact zero-authority race-placement registry", () => {
  const result = validateRacePlacementAuthority({ registryRoot: root, sourceRoot: root })
  assert.equal(result.activeRowCount, 0)
  assert.equal(result.reviewedCellCount, 12)
  assert.deepEqual(result.statusCounts, { DO_NOT_APPROVE: 12, NOT_FOUND: 0 })
})

test("rejects active rows, missing cells, operative dose, reviewer drift, and row digest mutation", () => {
  const mutations = [
    registry => { registry.activeRows.push(registry.reviewedCells[0]) },
    registry => { registry.reviewedCells.pop() },
    registry => { registry.numericTaperAuthority = "GRANTED" },
    registry => { registry.automatedReviewRecords[1].reviewerId = registry.automatedReviewRecords[0].reviewerId },
    registry => { registry.automatedReviewRecords[0].reviewerQualification = "QUALIFIED_RUNNING_COACH" },
    registry => { registry.automatedReviewRecords[0].authorityEffect = "ACTIVATE" },
    registry => { registry.automatedReviewRecords[0].verdictIsUnconditional = false },
    registry => { registry.reviewedCells[0].rowPayloadSha256 = `sha256:${"0".repeat(64)}` },
  ]
  for (const mutate of mutations) {
    withMutation(mutate, temporaryRoot => {
      assert.throws(() => validateRacePlacementAuthority({ registryRoot: temporaryRoot, sourceRoot: root }))
    })
  }
})

test("rejects source, event, projection, transfer, status, expiry, revocation, and permutation mutations", () => {
  const mutations = [
    registry => { registry.sourceEvidence[0].fragmentSha256 = `sha256:${"1".repeat(64)}` },
    registry => { registry.reviewedCells[0].eventDistanceM = 1500 },
    registry => { registry.reviewedCells[0].projectionH = 10 },
    registry => { registry.reviewedCells[0].youthTransfer = "APPROVED" },
    registry => { registry.reviewedCells[0].femaleSexTransfer = "APPROVED" },
    registry => { registry.reviewedCells[0].status = "ACTIVE" },
    registry => { registry.automatedReviewRecords[0].expiresAt = "2026-08-22T00:00:00.000Z" },
    registry => { registry.automatedReviewRecords[0].revoked = true },
    registry => { registry.reviewedCells[0].coordinatePermutation = [] },
  ]
  for (const mutate of mutations) {
    withMutation(mutate, temporaryRoot => {
      assert.throws(() => validateRacePlacementAuthority({ registryRoot: temporaryRoot, sourceRoot: root }))
    })
  }
})
