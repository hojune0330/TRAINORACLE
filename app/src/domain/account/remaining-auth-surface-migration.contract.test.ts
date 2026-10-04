import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const publicProfileMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0054_public_profile_admission_policies.sql"),
  "utf8",
).replaceAll("\r\n", "\n")
const remainingSurfaceMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0056_remaining_auth_surface_gates.sql"),
  "utf8",
).replaceAll("\r\n", "\n")

describe("remaining authentication surfaces", () => {
  it("applies the public-profile kill gate inside the anonymously callable helper", () => {
    const helperStart = publicProfileMigration.indexOf(
      "create or replace function public.account_subject_public_data_allowed(target_user uuid)",
    )
    const helperEnd = publicProfileMigration.indexOf(
      "revoke all on function public.account_subject_public_data_allowed(uuid)",
      helperStart,
    )
    const helper = publicProfileMigration.slice(helperStart, helperEnd)

    expect(helperStart).toBeGreaterThan(-1)
    expect(helperEnd).toBeGreaterThan(helperStart)
    expect(helper).toContain("public.public_profile_sharing_enabled() is true")
  })

  it("removes the directly callable guardian-authority oracle", () => {
    expect(remainingSurfaceMigration).toContain(
      "revoke all on function public.guardian_authority_allowed(uuid, text, date)\n  from public, anon, authenticated, service_role",
    )
    expect(remainingSurfaceMigration).not.toContain(
      "grant execute on function public.guardian_authority_allowed(uuid, text, date)",
    )
  })

  it("requires a supported current auth method before lounge admission", () => {
    const loungeStart = remainingSurfaceMigration.indexOf(
      "create or replace function public.get_lounge_admission()",
    )
    const loungeEnd = remainingSurfaceMigration.indexOf(
      "revoke all on function public.get_lounge_admission()",
      loungeStart,
    )
    const lounge = remainingSurfaceMigration.slice(loungeStart, loungeEnd)

    expect(lounge).toContain("public.current_jwt_auth_method_allowed() is distinct from true")
    expect(lounge.indexOf("current_jwt_auth_method_allowed")).toBeLessThan(
      lounge.indexOf("public.lounge_session_admission("),
    )
  })
})
