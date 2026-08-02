import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function readRepositoryFile(relativePath: string): string {
  const path = join(process.cwd(), "..", relativePath)
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}

function assertDeployReceipt(workflow: string): void {
  const requiredClauses = [
    "PREVIOUS_PAGES_SHA",
    "trainoracle-deploy-receipt.json",
    "sourceSha",
    "previousPagesSha",
    "workflowRunId",
    "Publish verified build to gh-pages",
  ]
  for (const clause of requiredClauses) {
    if (!workflow.includes(clause)) throw new Error(`missing deploy receipt clause: ${clause}`)
  }
}

function assertRetentionWorkflow(workflow: string): void {
  const requiredClauses = [
    "schedule:",
    "workflow_dispatch:",
    "TRAINORACLE_SERVER_OPERATIONS_ENABLED",
    "SUPABASE_SERVICE_ROLE_KEY",
    "/rest/v1/rpc/purge_expired_beta_data",
    "/rest/v1/rpc/purge_expired_feedback_threads",
    "feedback_deleted",
    "--fail-with-body",
    "floor == .",
    ". >= 0",
    "retention cleanup receipt",
  ]
  for (const clause of requiredClauses) {
    if (!workflow.includes(clause)) throw new Error(`missing retention workflow clause: ${clause}`)
  }
  if (workflow.includes("VITE_SUPABASE_ANON_KEY")) {
    throw new Error("retention cleanup must never use the public anon key")
  }
}

function assertRollbackWorkflow(workflow: string): void {
  const requiredClauses = [
    "workflow_dispatch:",
    "target_gh_pages_sha:",
    "reason_code:",
    "incident_issue_number:",
    "git merge-base --is-ancestor",
    'case "$REASON_CODE" in',
    'git ls-tree -r "$TARGET_SHA"',
    "120000",
    "trainoracle-rollback-receipt.json",
    "git push origin HEAD:gh-pages",
    "rollback receipt",
  ]
  for (const clause of requiredClauses) {
    if (!workflow.includes(clause)) throw new Error(`missing rollback workflow clause: ${clause}`)
  }
  if (/git push[^\n]+(?:--force|-f\b)/u.test(workflow)) {
    throw new Error("rollback must preserve deployment history")
  }
}

describe("server operations workflows", () => {
  it("publishes a deployment receipt with the previous Pages revision", () => {
    assertDeployReceipt(readRepositoryFile(".github/workflows/ci.yml"))
  })

  it("runs retention cleanup only through the server operations gate", () => {
    assertRetentionWorkflow(readRepositoryFile(".github/workflows/retention-cleanup.yml"))
  })

  it("rolls Pages back by adding history instead of rewriting it", () => {
    assertRollbackWorkflow(readRepositoryFile(".github/workflows/rollback-pages.yml"))
  })

  it.each([
    ["deploy previous SHA", ".github/workflows/ci.yml", "PREVIOUS_PAGES_SHA", "CURRENT_PAGES_SHA", assertDeployReceipt],
    ["retention service key", ".github/workflows/retention-cleanup.yml", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_ANON_KEY", assertRetentionWorkflow],
    ["retention integer counts", ".github/workflows/retention-cleanup.yml", "floor == .", "true", assertRetentionWorkflow],
    ["rollback ancestry", ".github/workflows/rollback-pages.yml", "git merge-base --is-ancestor", "git cat-file -e", assertRollbackWorkflow],
    ["rollback reason allowlist", ".github/workflows/rollback-pages.yml", 'case "$REASON_CODE" in', 'case "BROKEN_UI" in', assertRollbackWorkflow],
    ["rollback symlink rejection", ".github/workflows/rollback-pages.yml", "120000", "100644", assertRollbackWorkflow],
  ])("rejects hostile mutation: %s", (_label, path, originalClause, mutation, assertion) => {
    const original = readRepositoryFile(path)
    const mutated = original.replaceAll(originalClause, mutation)

    expect(mutated).not.toBe(original)
    expect(() => assertion(mutated)).toThrow()
  })
})
