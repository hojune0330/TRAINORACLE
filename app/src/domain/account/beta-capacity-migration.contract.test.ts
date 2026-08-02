import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = process.env.TRAINORACLE_CAPACITY_MIGRATION_PATH
  ?? join(process.cwd(), "..", "supabase", "migrations", "0016_atomic_beta_capacity.sql")
const migration = readFileSync(migrationPath, "utf8")

const claimFunction = migration.slice(
  migration.indexOf("create or replace function public.claim_beta_seat"),
  migration.indexOf("revoke all on function public.claim_beta_seat"),
)

describe("atomic 200-seat beta admission", () => {
  it("pins the public beta to exactly 200 seats", () => {
    expect(migration).toContain("seat_limit integer not null check (seat_limit = 200)")
    expect(migration).toContain("values ('PUBLIC_BETA', 200)")
    expect(migration).toContain("references auth.users (id) on delete cascade")
  })

  it("serializes admission before counting occupied seats", () => {
    const lockIndex = claimFunction.indexOf("for update")
    const countIndex = claimFunction.indexOf("select count(*)")

    expect(lockIndex).toBeGreaterThan(-1)
    expect(countIndex).toBeGreaterThan(lockIndex)
    expect(claimFunction).toContain("if occupied_seats >= capacity_limit then")
    expect(claimFunction).toContain("return 'BETA_FULL'")
  })

  it("makes repeated claims by one authenticated user idempotent", () => {
    const existingIndex = claimFunction.indexOf("from public.beta_enrollments enrollment")
    const countIndex = claimFunction.indexOf("select count(*)")

    expect(claimFunction).toContain("auth.uid() is null")
    expect(existingIndex).toBeGreaterThan(-1)
    expect(existingIndex).toBeLessThan(countIndex)
    expect(claimFunction).toContain("return 'ADMITTED_EXISTING'")
    expect(claimFunction).toContain("return 'ADMITTED_NEW'")
  })

  it("keeps profile creation behind the server claim function", () => {
    expect(claimFunction).toContain("insert into public.beta_enrollments")
    expect(claimFunction).toContain("insert into public.user_private_profiles")
    expect(migration).toContain("revoke insert on table public.user_private_profiles from authenticated")
    expect(migration).toContain("revoke update on table public.user_private_profiles from authenticated")
    expect(migration).toContain("revoke all on table public.beta_enrollments from authenticated")
    expect(migration).not.toMatch(/grant insert[^;]*user_private_profiles[^;]*authenticated/iu)
    expect(migration).not.toMatch(/grant (?:insert|update|delete)[^;]*beta_enrollments[^;]*authenticated/iu)
  })

  it("exposes only the authenticated claim action", () => {
    expect(migration).toContain("revoke all on function public.claim_beta_seat(date) from public")
    expect(migration).toContain("revoke all on function public.claim_beta_seat(date) from anon")
    expect(migration).toContain("grant execute on function public.claim_beta_seat(date) to authenticated")
  })

  it("requires an admitted seat for account network access", () => {
    expect(migration).toMatch(/account_network_access_allowed[\s\S]+from public\.beta_enrollments enrollment[\s\S]+enrollment\.user_id = target_user/u)
  })

  it("preserves the latest expiring guardian-authority access chain", () => {
    const accessFunction = migration.slice(
      migration.indexOf("create or replace function public.account_network_access_allowed"),
    )

    expect(accessFunction).toContain("volatile")
    expect(accessFunction).toContain("public.athlete_support_access_allowed(target_user)")
    expect(accessFunction).not.toContain("from public.guardian_confirmations confirmation")
  })
})
