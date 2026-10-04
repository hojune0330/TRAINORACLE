import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0053_supported_auth_method_gate.sql"),
  "utf8",
).replaceAll("\r\n", "\n")

function between(start: string, end: string): string {
  const startIndex = migration.indexOf(start)
  const endIndex = migration.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThan(-1)
  expect(endIndex).toBeGreaterThan(startIndex)
  return migration.slice(startIndex, endIndex)
}

describe("server authentication-method migration", () => {
  it("requires the JWT session id to remain live on the server", () => {
    const sessionGate = between(
      "create or replace function public.current_jwt_session_active()",
      "revoke all on function public.current_jwt_session_active()",
    )
    expect(sessionGate).toContain("auth.jwt() ->> 'session_id'")
    expect(sessionGate).toContain("from auth.sessions active_session")
    expect(sessionGate).toContain("active_session.user_id = actor")
    expect(sessionGate).toContain("active_session.not_after is null")

    const methodGate = between(
      "create or replace function public.current_jwt_auth_method_allowed()",
      "revoke all on function public.current_jwt_auth_method_allowed()",
    )
    expect(methodGate).toContain("public.current_jwt_session_active() is distinct from true")
  })

  it("validates the documented AMR shape and requires a supported origin", () => {
    const helper = between(
      "create or replace function public.current_jwt_auth_method_allowed()",
      "revoke all on function public.current_jwt_auth_method_allowed()",
    )

    expect(helper).toContain("auth.jwt() -> 'amr'")
    expect(helper).toContain("jsonb_typeof(methods) is distinct from 'array'")
    expect(helper).toContain("jsonb_array_length(methods) = 0")
    expect(helper).toContain("jsonb_typeof(method_entry) is distinct from 'object'")
    expect(helper).toContain("jsonb_typeof(method_entry -> 'method') is distinct from 'string'")
    expect(helper).toContain("jsonb_typeof(method_entry -> 'timestamp') is distinct from 'number'")
    expect(helper).toContain("from auth.users candidate")
    expect(helper).toContain("nullif(candidate.encrypted_password, '') is not null")
    expect(helper).toContain("return has_supported_origin")
    expect(helper).toContain("when others then\n    return false")
  })

  it("allows only TrainOracle passwordless origins plus a non-authorizing refresh marker", () => {
    const helper = between(
      "create or replace function public.current_jwt_auth_method_allowed()",
      "revoke all on function public.current_jwt_auth_method_allowed()",
    )

    for (const method of ["oauth", "otp", "magiclink", "email/signup", "token_refresh"]) {
      expect(helper).toContain(`'${method}'`)
    }
    for (const method of ["password", "anonymous", "recovery", "invite", "email_change", "totp", "sso/saml"]) {
      expect(helper).not.toContain(`'${method}'`)
    }
    const refreshIndex = helper.indexOf("'token_refresh'")
    const supportedOriginAssignment = helper.indexOf("has_supported_origin := true")
    expect(refreshIndex).toBeGreaterThan(-1)
    expect(supportedOriginAssignment).toBeGreaterThan(refreshIndex)
    expect(helper.slice(refreshIndex, supportedOriginAssignment)).not.toContain("has_supported_origin := true")
  })

  it("keeps public Auth API calls behind fail-closed server auth-channel controls", () => {
    expect(migration).toContain("('AUTH_OAUTH', false, 'INITIAL_SAFE_DEFAULT')")
    expect(migration).toContain("('AUTH_PASSWORDLESS', false, 'INITIAL_SAFE_DEFAULT')")
    const helper = between(
      "create or replace function public.current_jwt_auth_method_allowed()",
      "revoke all on function public.current_jwt_auth_method_allowed()",
    )
    expect(helper).toContain("public.service_feature_enabled('AUTH_OAUTH') is true")
    expect(helper).toContain("public.service_feature_enabled('AUTH_PASSWORDLESS') is true")
  })

  it("does not confuse a confirmed direct password signup with a passwordless email signup", () => {
    const helper = between(
      "create or replace function public.current_jwt_auth_method_allowed()",
      "revoke all on function public.current_jwt_auth_method_allowed()",
    )
    expect(helper).toContain("'email/signup'")
    expect(helper).toContain("candidate.id = auth.uid()")
    expect(helper.indexOf("encrypted_password")).toBeLessThan(helper.indexOf("return has_supported_origin"))
  })

  it("gates every claim shape, admission reads, and the canonical network predicate", () => {
    const networkGate = between(
      "create or replace function public.account_network_access_allowed(target_user uuid)",
      "revoke all on function public.account_network_access_allowed(uuid)",
    )
    const legacyClaim = between(
      "create or replace function public.claim_beta_seat(birth_date_input date)",
      "create or replace function public.claim_beta_seat(\n  birth_date_input date,",
    )
    const legacyLegalClaim = between(
      "create or replace function public.claim_beta_seat(\n  birth_date_input date,",
      "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid,",
    )
    const boundClaim = between(
      "create or replace function public.claim_beta_seat(\n  expected_user_id_input uuid,",
      "revoke all on function public.claim_beta_seat(date)",
    )
    const admission = between(
      "create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)",
      "revoke all on function public.get_current_account_admission_status(uuid)",
    )

    expect(networkGate).toContain("public.current_jwt_auth_method_allowed() is true")
    for (const body of [legacyClaim, legacyLegalClaim, boundClaim, admission]) {
      expect(body).toContain("public.current_jwt_auth_method_allowed() is distinct from true")
      expect(body).toContain("'AUTH_METHOD_UNSUPPORTED'")
    }
  })

  it("keeps deletion available across auth methods but denies a revoked server session", () => {
    const deletion = between(
      "create or replace function public.request_account_deletion(expected_user_id_input uuid)",
      "revoke all on function public.request_account_deletion(uuid)",
    )
    expect(deletion).toContain("public.current_jwt_session_active() is distinct from true")
    expect(deletion).not.toContain("current_jwt_auth_method_allowed")
  })

  it("keeps the helper private while preserving the existing public RPC grants", () => {
    expect(migration).toContain(
      "revoke all on function public.current_jwt_auth_method_allowed()\n  from public, anon, authenticated, service_role",
    )
    expect(migration).not.toContain("grant execute on function public.current_jwt_auth_method_allowed()")
    expect(migration).not.toContain("grant execute on function public.current_jwt_session_active()")
    expect(migration).toContain(
      "grant execute on function public.account_network_access_allowed(uuid) to authenticated, service_role",
    )
    expect(migration).toContain(
      "grant execute on function public.get_current_account_admission_status(uuid) to authenticated",
    )
  })
})
