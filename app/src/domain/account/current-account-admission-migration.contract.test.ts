import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CURRENT_ACCOUNT_LEGAL_VERSION } from "./config"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0051_current_account_admission.sql"),
  "utf8",
).replaceAll("\r\n", "\n")
const currentMigration = readFileSync(join(process.cwd(), "..", "supabase", "migrations", "0057_purpose_scoped_storage_consent.sql"), "utf8").replaceAll("\r\n", "\n")

function between(start: string, end: string): string {
  const startIndex = migration.indexOf(start)
  const endIndex = migration.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThan(-1)
  expect(endIndex).toBeGreaterThan(startIndex)
  return migration.slice(startIndex, endIndex)
}

describe("current-account server admission migration", () => {
  it("repairs the canonical network gate to use the KST birthday and account switch", () => {
    const networkGate = between(
      "create or replace function public.account_network_access_allowed(target_user uuid)",
      "-- Old clients do not bind the profile claim",
    )

    expect(networkGate).toContain("set search_path = pg_catalog")
    expect(networkGate).toContain("public.service_feature_enabled('ACCOUNT') is true")
    expect(networkGate).toContain("clock_timestamp() at time zone 'Asia/Seoul'")
    expect(networkGate).toContain("from public.beta_enrollments")
    expect(networkGate).toContain("from public.account_deletion_requests")
    expect(networkGate).toContain("grant execute on function public.account_network_access_allowed(uuid) to authenticated, service_role")
  })

  it("exposes only an authenticated current-caller status with no-cache semantics", () => {
    const admission = between(
      "create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)",
      "comment on function public.get_current_account_admission_status(uuid)",
    )

    expect(admission).toContain("security definer")
    expect(admission).toContain("set search_path = pg_catalog")
    expect(admission).toContain("auth.uid()")
    expect(admission).toContain("auth.jwt() ->> 'role' is distinct from 'authenticated'")
    expect(admission).toContain("set_config('response.headers', '[{\"Cache-Control\":\"no-store\"}]', true)")
    expect(migration).toContain("from public, anon, authenticated, service_role")
    expect(admission).toContain("actor is distinct from expected_user_id_input")
    expect(migration).toContain("grant execute on function public.get_current_account_admission_status(uuid) to authenticated")
    expect(migration).not.toContain("grant execute on function public.get_current_account_admission_status(uuid) to anon")
  })

  it("checks every admission boundary before returning ADMITTED", () => {
    const admission = currentMigration.split("create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)")[1]!.split("create or replace function public.account_subject_public_data_allowed")[0]!

    for (const status of [
      "LOGIN_REQUIRED",
      "IDENTITY_MISMATCH",
      "ACCOUNT_DISABLED",
      "DELETION_REQUESTED",
      "NEEDS_PROFILE",
      "UNDER_14",
      "LEGAL_RECONSENT_REQUIRED",
      "BETA_NOT_ENROLLED",
      "RESTRICTED",
      "ADMITTED",
    ]) expect(admission).toContain(`'${status}'`)
    expect(admission).toContain("public.service_feature_enabled('ACCOUNT') is distinct from true")
    expect(admission).toContain("from public.account_deletion_requests")
    expect(admission).toContain("from public.beta_enrollments")
    expect(admission).toContain("public.account_admission_access_allowed(actor) is distinct from true")
    expect(admission).toContain("clock_timestamp() at time zone 'Asia/Seoul'")
    expect(admission).toContain(`profile.privacy_policy_version is distinct from '${CURRENT_ACCOUNT_LEGAL_VERSION}'`)
    expect(admission).toContain(`profile.terms_of_service_version is distinct from '${CURRENT_ACCOUNT_LEGAL_VERSION}'`)
    expect(admission).toContain("profile.legal_consented_at > now_at")
  })

  it("binds profile claims to the verified actor in the same transaction", () => {
    const claim = between(
      "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid",
      "revoke all on function public.claim_beta_seat(date)",
    )
    const identityCheck = claim.indexOf("actor is distinct from expected_user_id_input")
    const firstWrite = claim.indexOf("insert into public.beta_enrollments")

    expect(identityCheck).toBeGreaterThan(-1)
    expect(firstWrite).toBeGreaterThan(identityCheck)
    expect(claim).toContain("public.service_feature_enabled('ACCOUNT') is distinct from true")
    expect(claim).toContain("clock_timestamp() at time zone 'Asia/Seoul'")
    expect(claim).toContain("return 'BIRTH_DATE_MISMATCH'")
    expect(claim).toContain("set privacy_policy_version = privacy_policy_version_input")
    expect(claim).not.toMatch(/set\s+birth_date\s*=/u)
  })

  it("keeps legacy claim shapes callable but unable to write a profile or seat", () => {
    const legacy = migration.slice(0, migration.indexOf(
      "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid",
    ))
    expect(legacy.match(/return 'CLIENT_UPDATE_REQUIRED'/gu)).toHaveLength(2)
    expect(legacy).not.toContain("insert into public.beta_enrollments")
    expect(legacy).not.toContain("insert into public.user_private_profiles")
  })

  it("replaces deletion with an atomically identity-bound RPC and closes the old shape", () => {
    const deletion = between(
      "create or replace function public.request_account_deletion(expected_user_id_input uuid)",
      "create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)",
    )
    const identityCheck = deletion.indexOf("actor is distinct from expected_user_id_input")
    const write = deletion.indexOf("insert into public.account_deletion_requests")

    expect(identityCheck).toBeGreaterThan(-1)
    expect(write).toBeGreaterThan(identityCheck)
    expect(deletion).toContain("set search_path = pg_catalog")
    expect(deletion).toContain("revoke all on function public.request_account_deletion()")
    expect(deletion).toContain("grant execute on function public.request_account_deletion(uuid) to authenticated")
    expect(deletion).not.toContain("grant execute on function public.request_account_deletion()")
  })
})
