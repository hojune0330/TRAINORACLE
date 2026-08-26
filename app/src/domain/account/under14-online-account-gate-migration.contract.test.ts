import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0028_under_14_online_account_gate.sql"),
  "utf8",
)

describe("under-14 online account server gate", () => {
  it("blocks profile inserts and birth-date changes before they reach storage", () => {
    expect(migration).toContain("new.birth_date > (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'")
    expect(migration).toContain("before insert or update of birth_date")
    expect(migration).toContain("under 14 online account not offered")
  })

  it("does not grant direct execution to browser roles", () => {
    expect(migration).toContain("revoke all on function public.block_under_14_online_profile() from anon")
    expect(migration).toContain("revoke all on function public.block_under_14_online_profile() from authenticated")
    expect(migration).not.toMatch(/grant execute/iu)
  })

  it("also denies network access to retained legacy profiles while they are under 14", () => {
    expect(migration).toContain("profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'")
    expect(migration).toContain("create or replace function public.account_network_access_allowed")
  })
})
