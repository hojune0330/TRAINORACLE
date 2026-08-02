import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0008_plan_proposal_actions.sql"),
  "utf8",
)
const atomicMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0015_plan_proposal_atomic_activation.sql"),
  "utf8",
)

describe("plan proposal server actions", () => {
  it("forces every inserted proposal to start as an untouched draft", () => {
    expect(migration).toContain("status = 'DRAFT'")
    expect(migration).toContain("first_warning_reviewed_at is null")
    expect(migration).toContain("warning_acknowledged_at is null")
  })

  it("removes the legacy status-only activation route and grants only atomic actions", () => {
    expect(migration).toContain("revoke update on table public.plan_proposals from authenticated")
    expect(atomicMigration).toContain("drop function if exists public.review_plan_proposal(uuid)")
    expect(atomicMigration).toContain("record_plan_proposal_warning_review")
    expect(atomicMigration).toContain("activate_plan_proposal")
    expect(atomicMigration).not.toContain("grant execute on function public.review_plan_proposal")
  })

  it("lets an active supporter create a draft without impersonating the athlete", () => {
    expect(migration).toContain("public.can_create_plan_proposal(athlete_id)")
    expect(migration).toContain("public.athlete_support_access_allowed(target_athlete)")
    expect(migration).toContain("connection.supporter_id = auth.uid()")
    expect(migration).toContain("proposed_by = auth.uid()")
    expect(migration).toContain("grant execute on function public.can_create_plan_proposal(uuid) to authenticated")
  })

  it("requires warning review before accepted-with-warning without deleting history", () => {
    expect(atomicMigration).toContain("WARNING_REVIEWED")
    expect(atomicMigration).toContain("USER_ACCEPTED_WITH_WARNING")
    expect(atomicMigration).not.toMatch(/delete from public\.plan_proposals/iu)
  })
})
