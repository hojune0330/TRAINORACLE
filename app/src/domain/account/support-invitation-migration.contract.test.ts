import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0004_support_invitations.sql"),
  "utf8",
)
const hardeningMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0005_support_connection_hardening.sql"),
  "utf8",
)

describe("support invitation database contract", () => {
  it("stores a hash instead of the shareable code", () => {
    expect(migration).toContain("code_hash text not null unique")
    expect(migration).not.toContain("invite_code text")
  })

  it("accepts a code only through an authenticated database function", () => {
    expect(migration).toContain("accept_support_invitation")
    expect(migration).toContain("auth.uid()")
    expect(migration).toContain("expires_at > now()")
  })

  it("keeps the supporter label unverified", () => {
    expect(migration).toContain("'자격 미확인'")
  })

  it("prevents clients from bypassing invitation and guardian checks with a direct insert", () => {
    expect(hardeningMigration).toContain("revoke insert on table public.support_connections from authenticated")
    expect(hardeningMigration).toContain("revoke update on table public.support_connections from authenticated")
    expect(hardeningMigration).toContain("grant insert on table public.support_connections to service_role")
  })
})
