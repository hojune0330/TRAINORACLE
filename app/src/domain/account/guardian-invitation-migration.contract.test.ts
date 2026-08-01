import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0007_guardian_confirmations.sql"),
  "utf8",
)
const accessFunction = migration.slice(
  migration.indexOf("create or replace function public.athlete_support_access_allowed"),
  migration.indexOf("revoke all on function public.athlete_support_access_allowed"),
)

describe("guardian confirmation database contract", () => {
  it("binds every confirmation to an authenticated guardian account", () => {
    expect(migration).toContain("guardian_user_id uuid references auth.users")
    expect(migration).toMatch(/guardian_user_id,[\s\S]+values \([\s\S]+auth\.uid\(\)/u)
    expect(migration).toContain("child_user_id <> auth.uid()")
  })

  it("stores only a hash of the one-time guardian code", () => {
    expect(migration).toContain("code_hash text not null unique")
    expect(migration).not.toContain("guardian_code text")
  })

  it("creates account-sync consent only through the guarded acceptance function", () => {
    expect(migration).toContain("accept_guardian_invitation")
    expect(migration).toContain("scope = 'ACCOUNT_SYNC'")
    expect(migration).toContain("expires_at > now()")
    expect(migration).toContain("grant execute on function public.accept_guardian_invitation(text) to authenticated")
  })

  it("carries the authenticated guardian confirmation into the first support connection", () => {
    expect(migration).toContain("'FIRST_LINK'")
    expect(migration).toContain("first_link_confirmation_id")
    expect(migration).toContain("guardian_confirmation_id")
  })

  it("lets the invited supporter verify athlete availability without impersonating the athlete", () => {
    expect(migration).toContain("athlete_support_access_allowed")
    expect(migration).toMatch(/accept_support_invitation[\s\S]+athlete_support_access_allowed\(invitation\.athlete_id\)/u)
    expect(migration).not.toMatch(/accept_support_invitation[\s\S]+account_network_access_allowed\(invitation\.athlete_id\)/u)
  })

  it("keeps network access closed until a valid profile exists and after deletion is requested", () => {
    expect(accessFunction).toMatch(/exists \([\s\S]+from public\.user_private_profiles profile[\s\S]+profile\.deletion_requested_at is null/u)
    expect(accessFunction).toMatch(/not exists \([\s\S]+from public\.account_deletion_requests request/u)
    expect(accessFunction).not.toMatch(/not exists \([\s\S]+from public\.user_private_profiles profile[\s\S]+profile\.birth_date > current_date - interval '14 years'/u)
  })
})
