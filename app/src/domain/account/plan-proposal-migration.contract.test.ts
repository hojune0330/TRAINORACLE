import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0008_plan_proposal_actions.sql"),
  "utf8",
)

describe("plan proposal server actions", () => {
  it("forces every inserted proposal to start as an untouched draft", () => {
    expect(migration).toContain("status = 'DRAFT'")
    expect(migration).toContain("first_warning_reviewed_at is null")
    expect(migration).toContain("warning_acknowledged_at is null")
  })

  it("removes direct client updates and lets only the athlete review a proposal", () => {
    expect(migration).toContain("revoke update on table public.plan_proposals from authenticated")
    expect(migration).toContain("proposal.athlete_id <> auth.uid()")
    expect(migration).toContain("public.athlete_support_access_allowed(proposal.athlete_id)")
    expect(migration).toContain("review_plan_proposal")
  })

  it("lets an active supporter create a draft without impersonating the athlete", () => {
    expect(migration).toContain("public.can_create_plan_proposal(athlete_id)")
    expect(migration).toContain("public.athlete_support_access_allowed(target_athlete)")
    expect(migration).toContain("connection.supporter_id = auth.uid()")
    expect(migration).toContain("proposed_by = auth.uid()")
    expect(migration).toContain("grant execute on function public.can_create_plan_proposal(uuid) to authenticated")
  })

  it("requires warning review before accepted-with-warning without deleting history", () => {
    expect(migration).toContain("WARNING_REVIEWED")
    expect(migration).toContain("USER_ACCEPTED_WITH_WARNING")
    expect(migration).not.toMatch(/delete from public\.plan_proposals/iu)
  })
})
