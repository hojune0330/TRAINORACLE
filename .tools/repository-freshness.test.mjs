import assert from "node:assert/strict"
import test from "node:test"
import { evaluateFreshness, validateBranchDecisions } from "./repository-freshness.mjs"

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

const reviewedBranch = { name: "codex/closed", sha: "d".repeat(40), committedAt: "2026-08-14T12:00:00Z" }
const decision = {
  branch: reviewedBranch.name, sha: reviewedBranch.sha, reviewedAgainst: current.main.sha,
  disposition: "superseded", reason: "The current implementation replaces the historical proposal.",
  evidence: ["app/src/domain/example.ts: current implementation"],
}
const closedPull = { number: 220, state: "closed", mergedAt: null, head: { ref: reviewedBranch.name, sha: reviewedBranch.sha } }

test("records an explicit historical decision without pretending its PR was merged", () => {
  const result = evaluateFreshness({ ...current, branches: [reviewedBranch], pulls: [closedPull], branchDecisions: [decision] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.reviewedBranches, ["codex/closed@ddddddd (superseded)"])
  assert.deepEqual(result.openPullRequests, [])
})

test("a new commit on a reviewed branch must be assessed again", () => {
  const result = evaluateFreshness({ ...current, branches: [{ ...reviewedBranch, sha: "e".repeat(40) }], pulls: [closedPull], branchDecisions: [decision] })
  assert.equal(result.ok, false)
  assert.match(result.unresolvedBranches[0], /ADVANCED_AFTER_PR/u)
  assert.deepEqual(result.reviewedBranches, [])
})

test("reopened work cannot be hidden by a historical decision", () => {
  const result = evaluateFreshness({ ...current, branches: [reviewedBranch], pulls: [{ ...closedPull, state: "open", head: { ...closedPull.head, sha: "e".repeat(40) } }], branchDecisions: [decision] })
  assert.equal(result.ok, false)
  assert.deepEqual(result.reviewedBranches, [])
  assert.deepEqual(result.openPullRequests, [220])
})

test("historical decisions never excuse an outdated deployment", () => {
  const result = evaluateFreshness({ ...current, branches: [reviewedBranch], pulls: [closedPull], branchDecisions: [decision], deployment: { sourceSha: "f".repeat(40) } })
  assert.equal(result.ok, false)
  assert.match(result.problems[0], /Pages source/u)
})

test("invalid or unsupported decisions fail closed", () => {
  for (const invalid of [{ ...decision, sha: "*" }, { ...decision, branch: "main" }, { ...decision, evidence: [] }, { ...decision, disposition: "ignore" }, { ...decision, reviewedAgainst: "latest" }]) {
    assert.throws(() => validateBranchDecisions([invalid]), /Invalid branch decision/u)
  }
  assert.throws(() => validateBranchDecisions([decision, decision]), /Invalid branch decision/u)
})
