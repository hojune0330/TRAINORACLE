import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0055_session_bound_account_admission.sql"),
  "utf8",
).replaceAll("\r\n", "\n")

const legacyStart = migration.indexOf(
  "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid,\n  birth_date_input date,",
)
const boundStart = migration.indexOf(
  "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid,\n  expected_session_id_input uuid,",
)
const grantsStart = migration.indexOf(
  "revoke all on function public.claim_beta_seat(uuid, date, text, text)",
)

describe("session-bound account admission migration", () => {
  it("keeps the legacy overload non-writing and forces a client update", () => {
    expect(legacyStart).toBeGreaterThan(-1)
    expect(boundStart).toBeGreaterThan(legacyStart)
    const legacyBody = migration.slice(legacyStart, boundStart)

    expect(legacyBody).toContain("return 'CLIENT_UPDATE_REQUIRED'")
    expect(legacyBody).not.toMatch(/\binsert\s+into\b/i)
    expect(legacyBody).not.toMatch(/\bupdate\s+public\./i)
  })

  it("compares the expected session with the signed JWT before the first write", () => {
    expect(boundStart).toBeGreaterThan(-1)
    expect(grantsStart).toBeGreaterThan(boundStart)
    const boundBody = migration.slice(boundStart, grantsStart)
    const sessionClaim = boundBody.indexOf("auth.jwt() ->> 'session_id'")
    const sessionComparison = boundBody.indexOf("current_session_id is distinct from expected_session_id_input")
    const firstWrite = Math.min(
      ...[boundBody.search(/\binsert\s+into\b/i), boundBody.search(/\bupdate\s+public\./i)]
        .filter(index => index >= 0),
    )

    expect(sessionClaim).toBeGreaterThan(-1)
    expect(sessionComparison).toBeGreaterThan(sessionClaim)
    expect(boundBody).toContain("return 'SESSION_MISMATCH'")
    expect(firstWrite).toBeGreaterThan(sessionComparison)
  })

  it("revokes both signatures before granting only authenticated callers", () => {
    expect(migration).toContain(
      "revoke all on function public.claim_beta_seat(uuid, date, text, text)\n  from public, anon, authenticated, service_role",
    )
    expect(migration).toContain(
      "revoke all on function public.claim_beta_seat(uuid, uuid, date, text, text)\n  from public, anon, authenticated, service_role",
    )
    expect(migration).toContain(
      "grant execute on function public.claim_beta_seat(uuid, uuid, date, text, text)\n  to authenticated",
    )
    expect(migration).not.toContain(
      "grant execute on function public.claim_beta_seat(uuid, uuid, date, text, text)\n  to anon",
    )
  })
})
