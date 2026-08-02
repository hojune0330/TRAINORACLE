import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = process.env.TRAINORACLE_FUNCTION_PRIVILEGE_MIGRATION_PATH
  ?? join(process.cwd(), "..", "supabase", "migrations", "0019_function_execute_privilege_hardening.sql")
const migration = readFileSync(migrationPath, "utf8")

const authenticatedFunctions = [
  "accept_guardian_invitation(text)",
  "accept_support_invitation(text)",
  "account_network_access_allowed(uuid)",
  "activate_plan_proposal(uuid)",
  "first_link_guardian_requirement_met(uuid, uuid, date)",
  "record_plan_proposal_warning_review(uuid, text)",
  "request_account_deletion()",
] as const

const internalOnlyFunctions = [
  "block_account_after_deletion_request()",
  "enforce_guardian_connection_authority()",
  "first_link_guardian_requirement_met(uuid, uuid)",
] as const

describe("security-definer function execute privileges", () => {
  it("removes anonymous execution from every affected function", () => {
    for (const signature of [...authenticatedFunctions, ...internalOnlyFunctions]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public;`)
      expect(migration).toContain(`revoke all on function public.${signature} from anon;`)
    }
  })

  it("restores only the authenticated application API", () => {
    for (const signature of authenticatedFunctions) {
      expect(migration).toContain(`grant execute on function public.${signature} to authenticated;`)
      expect(migration).toContain(`grant execute on function public.${signature} to service_role;`)
    }
  })

  it("keeps trigger and retired helper functions internal", () => {
    for (const signature of internalOnlyFunctions) {
      expect(migration).toContain(`revoke all on function public.${signature} from authenticated;`)
      expect(migration).toContain(`revoke all on function public.${signature} from service_role;`)
      expect(migration).not.toContain(`grant execute on function public.${signature}`)
    }
  })
})
