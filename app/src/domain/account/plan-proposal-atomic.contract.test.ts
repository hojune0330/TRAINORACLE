import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"

const migrationsDirectory = join(process.cwd(), "..", "supabase", "migrations")

function planProposalMigrations(): readonly string[] {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => /plan_proposal/iu.test(fileName))
    .sort()
    .map((fileName) => readFileSync(join(migrationsDirectory, fileName), "utf8"))
}

function assertAtomicActivationContract(migration: string): void {
  const requiredClauses = [
    "base_active_revision integer",
    "expires_at timestamptz",
    "safety_snapshot_id uuid",
    "create table if not exists public.plan_safety_snapshots",
    "revoke all on table public.plan_safety_snapshots from authenticated",
    "create table if not exists public.plan_versions",
    "create table if not exists public.athlete_active_plans",
    "create table if not exists public.plan_activation_receipts",
    "create or replace function public.record_plan_proposal_warning_review",
    "create or replace function public.activate_plan_proposal",
    "for update;",
    "SAFETY_SNAPSHOT_MISSING",
    "STALE_SAFETY_SNAPSHOT",
    "REVISION_CONFLICT",
    "PLAN_PROPOSAL_EXPIRED",
    "PLAN_PROPOSAL_REVIEW_REQUIRED",
    "insert into public.plan_versions",
    "update public.athlete_active_plans",
    "update public.plan_proposals",
    "insert into public.plan_activation_receipts",
    "'outcome', 'ACTIVATED'",
    "'activeRevision'",
  ]
  for (const clause of requiredClauses) {
    if (!migration.includes(clause)) throw new Error(`missing atomic activation clause: ${clause}`)
  }
}

describe("plan proposal atomic activation migration", () => {
  it("characterizes that the legacy status-only route activates a proposal", () => {
    const legacyMigration = readFileSync(
      join(migrationsDirectory, "0008_plan_proposal_actions.sql"),
      "utf8",
    )

    expect(legacyMigration).toContain("set status = 'ACTIVE'")
    expect(legacyMigration).toContain("set status = 'USER_ACCEPTED_WITH_WARNING'")
  })

  it("retires the legacy status-only review route so it cannot activate a plan", () => {
    const migrations = planProposalMigrations()
    const latestRouteReference = migrations.join("\n").lastIndexOf("review_plan_proposal")
    const retiredRoute = migrations.join("\n").slice(latestRouteReference - 40, latestRouteReference + 100)

    expect(latestRouteReference).toBeGreaterThanOrEqual(0)
    expect(retiredRoute).toContain("drop function if exists public.review_plan_proposal(uuid)")
  })

  it("rejects stale base revisions and missing or expired server safety snapshots", () => {
    const migration = readFileSync(
      join(migrationsDirectory, "0015_plan_proposal_atomic_activation.sql"),
      "utf8",
    )

    assertAtomicActivationContract(migration)
  })

  it("requires warning review and atomic activation as distinct server actions", () => {
    const migration = readFileSync(
      join(migrationsDirectory, "0015_plan_proposal_atomic_activation.sql"),
      "utf8",
    )

    expect(migration).toContain("WARNING_REVIEW_NOT_AVAILABLE")
    expect(migration).toContain("warning_review_reason")
    expect(migration).toContain("proposal.status = 'WARNING_REVIEWED'")
    expect(migration).toContain("warning_reviewed_by = auth.uid()")
    expect(migration).toContain("USER_ACCEPTED_WITH_WARNING")
  })

  it("proves the source contract detects a hostile mutation and cleans its temporary copy", () => {
    const sourcePath = join(migrationsDirectory, "0015_plan_proposal_atomic_activation.sql")
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "trainoracle-plan-proposal-"))
    const temporaryMigration = join(temporaryDirectory, "0015_plan_proposal_atomic_activation.sql")
    const original = readFileSync(sourcePath, "utf8")

    try {
      const mutated = original.replaceAll("for update;", "for share;")
      expect(mutated).not.toBe(original)
      writeFileSync(temporaryMigration, mutated, "utf8")
      expect(() => assertAtomicActivationContract(readFileSync(temporaryMigration, "utf8"))).toThrow(
        "missing atomic activation clause: for update;",
      )
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
