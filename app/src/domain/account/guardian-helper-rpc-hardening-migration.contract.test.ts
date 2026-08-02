import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = process.env.TRAINORACLE_GUARDIAN_HELPER_HARDENING_MIGRATION_PATH
  ?? join(process.cwd(), "..", "supabase", "migrations", "0020_guardian_helper_rpc_hardening.sql")
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : ""

describe("guardian helper RPC hardening", () => {
  it("adds a forward-only hardening migration", () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it("binds direct guardian checks to the signed-in athlete", () => {
    expect(migration).toMatch(/select auth\.uid\(\) = athlete[\s\S]+user_private_profiles/u)
  })

  it("keeps invitation acceptance independent of the athlete-bound RPC", () => {
    const acceptanceStart = migration.indexOf(
      "create or replace function public.accept_support_invitation(invitation_code_hash text)",
    )
    const acceptanceEnd = migration.indexOf("\n$$;", acceptanceStart)
    const acceptanceDefinition = migration.slice(acceptanceStart, acceptanceEnd)

    expect(acceptanceStart).toBeGreaterThanOrEqual(0)
    expect(acceptanceEnd).toBeGreaterThan(acceptanceStart)
    expect(acceptanceDefinition).not.toContain("public.first_link_guardian_requirement_met(")
    expect(acceptanceDefinition).toContain("public.user_private_profiles")
    expect(acceptanceDefinition).toContain("public.guardian_confirmations")
  })
})
