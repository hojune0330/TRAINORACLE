import assert from "node:assert/strict"
import test from "node:test"
import { evaluateFreshness } from "./repository-freshness.mjs"

const current = {
  main: { sha: "a".repeat(40), committedAt: "2026-08-15T00:00:00Z" },
  branches: [],
  pulls: [],
  deployment: { sourceSha: "a".repeat(40) },
}

test("passes when Pages matches main and no post-activation branch is untracked", () => {
  assert.equal(evaluateFreshness(current).ok, true)
})

test("keeps tracking an unreviewed branch after main becomes newer", () => {
  const result = evaluateFreshness({
    ...current,
    branches: [{ name: "codex/untracked", sha: "b".repeat(40), committedAt: "2026-08-14T12:00:00Z" }],
  })
  assert.deepEqual(result.unresolvedBranches, ["codex/untracked@bbbbbbb (NO_PR)"])
  assert.equal(result.ok, false)
})

test("accepts a post-activation branch once any pull request records it", () => {
  const result = evaluateFreshness({
    ...current,
    branches: [{ name: "codex/tracked", sha: "b".repeat(40), committedAt: "2026-08-14T12:00:00Z" }],
    pulls: [{ number: 219, state: "open", mergedAt: null, head: { ref: "codex/tracked", sha: "b".repeat(40) } }],
  })
  assert.equal(result.ok, true)
})

test("fails when Pages deploys a different main commit", () => {
  const result = evaluateFreshness({
    ...current,
    deployment: { sourceSha: "c".repeat(40) },
  })
  assert.match(result.problems[0], /Pages source/u)
  assert.equal(result.ok, false)
})

test('operator-note-only ancestry is reported without falsifying the deployed SHA', () => {
  const deployment = { sourceSha: 'b'.repeat(40) }
  const deploymentDelta = { base: deployment.sourceSha, head: current.main.sha, complete: true, paths: ['docs/delivery/README.md'] }
  const result = evaluateFreshness({ ...current, deployment, deploymentDelta })
  assert.equal(result.ok, true)
  assert.equal(result.deploymentSourceSha, deployment.sourceSha)
  assert.equal(result.deploymentAlignment, 'OPERATOR_NOTES_ONLY_RUNTIME_UNCHANGED')
  for (const delta of [null, { ...deploymentDelta, complete: false }, { ...deploymentDelta, head: 'c'.repeat(40) },
    { ...deploymentDelta, paths: ['app/src/main.tsx'] }, { ...deploymentDelta, paths: [] }]) {
    assert.equal(evaluateFreshness({ ...current, deployment, deploymentDelta: delta }).ok, false)
  }
})

test("fails when the newest pull request was closed without merging", () => {
  const result = evaluateFreshness({
    ...current,
    branches: [{ name: "codex/closed", sha: "d".repeat(40), committedAt: "2026-08-14T12:00:00Z" }],
    pulls: [{ number: 220, state: "closed", mergedAt: null, head: { ref: "codex/closed", sha: "d".repeat(40) } }],
  })
  assert.equal(result.ok, false)
})

test("fails when a branch advances after its pull request head", () => {
  const result = evaluateFreshness({
    ...current,
    branches: [{ name: "codex/advanced", sha: "e".repeat(40), committedAt: "2026-08-14T12:00:00Z" }],
    pulls: [{ number: 221, state: "open", mergedAt: null, head: { ref: "codex/advanced", sha: "f".repeat(40) } }],
  })
  assert.equal(result.ok, false)
})
