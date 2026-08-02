import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0014_guardian_invitation_server_expiry.sql"),
  "utf8",
)

describe("guardian invitation server expiry database contract", () => {
  it("derives and caps guardian invitation expiry on database time", () => {
    expect(migration).toContain("create_guardian_invitation(invitation_code_hash text)")
    expect(migration).toContain("clock_timestamp() + interval '7 days'")
    expect(migration).toContain("expires_at <= created_at + interval '7 days'")
    expect(migration).toContain("revoke insert on table public.guardian_invitations from authenticated")
  })

  it("detects a hostile mutation that removes server-side expiry derivation", () => {
    const requiredClause = "clock_timestamp() + interval '7 days'"
    const hostileMigration = migration.replaceAll(requiredClause, "")

    expect(hostileMigration).not.toContain(requiredClause)
  })
})
