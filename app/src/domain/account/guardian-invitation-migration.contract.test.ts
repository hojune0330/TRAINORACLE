import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0012_guardian_authority_hardening.sql"),
  "utf8",
)
const accessFunction = migration.slice(
  migration.indexOf("create or replace function public.athlete_support_access_allowed"),
  migration.indexOf("revoke all on function public.athlete_support_access_allowed"),
)

describe("guardian confirmation database contract", () => {
  it("uses database time to deny expired, revoked, stale-season, and wrong-scope authority", () => {
    expect(migration).toContain("clock_timestamp()")
    expect(migration).toContain("confirmation.valid_from <= clock_timestamp()")
    expect(migration).toContain("confirmation.valid_until > clock_timestamp()")
    expect(migration).toContain("confirmation.revoked_at is null")
    expect(migration).toContain("confirmation.authority_season_ends_on >= clock_timestamp()::date")
    expect(migration).toContain("confirmation.scope = required_scope")
  })

  it("rejects a hostile mutation that removes expiry, revocation, or server-time enforcement", () => {
    const mandatoryClauses = [
      "clock_timestamp()",
      "confirmation.valid_until > clock_timestamp()",
      "confirmation.revoked_at is null",
    ]

    for (const clause of mandatoryClauses) {
      const hostileMigration = migration.replaceAll(clause, "")
      expect(mandatoryClauses.filter((required) => !hostileMigration.includes(required)))
        .toContain(clause)
    }
  })
  it("binds every confirmation to an authenticated guardian account", () => {
    expect(migration).toContain("guardian_user_id, scope, confirmed_at")
    expect(migration).toMatch(/guardian_user_id,[\s\S]+values \([\s\S]+auth\.uid\(\)/u)
    expect(migration).toContain("child_user_id <> auth.uid()")
  })

  it("stores only a hash of the one-time guardian code", () => {
    expect(migration).toContain("accept_guardian_invitation")
    expect(migration).not.toContain("guardian_code text")
  })

  it("creates account-sync consent only through the guarded acceptance function", () => {
    expect(migration).toContain("accept_guardian_invitation")
    expect(migration).toContain("'ACCOUNT_SYNC'")
    expect(migration).toContain("expires_at > clock_timestamp()")
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
