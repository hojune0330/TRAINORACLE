import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "..",
  "supabase",
  "migrations",
  "0018_server_operations.sql",
)

function loadMigration(): string {
  return existsSync(migrationPath)
    ? readFileSync(migrationPath, "utf8").replaceAll("\r\n", "\n")
    : ""
}

const featureTriggerCases = [
  ["account_feature_write_guard", "public.beta_enrollments", "ACCOUNT"],
  ["sync_feature_write_guard", "public.journal_entries", "SYNC"],
  ["tombstone_sync_feature_write_guard", "public.journal_tombstones", "SYNC"],
  ["private_note_sync_feature_write_guard", "public.encrypted_private_notes", "SYNC"],
  ["support_invitation_feature_write_guard", "public.support_invitations", "SHARING"],
  ["guardian_invitation_feature_write_guard", "public.guardian_invitations", "SHARING"],
  ["guardian_confirmation_feature_write_guard", "public.guardian_confirmations", "SHARING"],
  ["support_connection_feature_write_guard", "public.support_connections", "SHARING"],
  ["plan_proposal_feature_write_guard", "public.plan_proposals", "PLAN_PROPOSALS"],
  ["plan_safety_feature_write_guard", "public.plan_safety_snapshots", "PLAN_PROPOSALS"],
  ["plan_version_feature_write_guard", "public.plan_versions", "PLAN_PROPOSALS"],
  ["active_plan_feature_write_guard", "public.athlete_active_plans", "PLAN_PROPOSALS"],
  ["plan_receipt_feature_write_guard", "public.plan_activation_receipts", "PLAN_PROPOSALS"],
  ["analytics_feature_write_guard", "public.product_analytics_events", "PRODUCT_ANALYTICS"],
] as const

function assertFeatureTrigger(
  migration: string,
  triggerName: string,
  tableName: string,
  feature: string,
): void {
  const start = migration.indexOf(`create trigger ${triggerName}`)
  const trigger = migration.slice(start, migration.indexOf(";", start) + 1)
  if (!trigger.includes(`on ${tableName}`)) throw new Error(`wrong trigger table: ${triggerName}`)
  if (!trigger.includes(`public.enforce_service_feature_write('${feature}')`)) {
    throw new Error(`wrong trigger feature: ${triggerName}`)
  }
}

function assertServerOperationsMigration(migration: string): void {
  const requiredClauses = [
    "create table if not exists public.service_feature_controls",
    "create table if not exists public.service_feature_control_events",
    "create table if not exists public.retention_cleanup_runs",
    "check (feature_key in ('ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS'))",
    "values\n  ('ACCOUNT', false, 'INITIAL_SAFE_DEFAULT')",
    "create or replace function public.service_feature_enabled(feature_key_input text)",
    "create or replace function public.set_service_feature_state(",
    "grant execute on function public.set_service_feature_state(text, boolean, text) to service_role",
    "coalesce(auth.jwt() ->> 'role', '') <> 'service_role'",
    "create or replace function public.get_service_feature_states()",
    "create or replace function public.can_access_shared_athlete_data(target_athlete uuid)",
    "create or replace function public.guardian_authority_allowed(",
    "revoke all on table public.service_feature_controls from authenticated",
    "revoke all on table public.service_feature_control_events from authenticated",
    "revoke all on table public.retention_cleanup_runs from authenticated",
    "public.service_feature_enabled('ACCOUNT')",
    "public.service_feature_enabled('SYNC')",
    "public.service_feature_enabled('SHARING')",
    "public.service_feature_enabled('PLAN_PROPOSALS')",
    "public.service_feature_enabled('PRODUCT_ANALYTICS')",
    "before insert or update on public.product_analytics_events",
    "if not enabled_input then",
    "delete from public.product_analytics_events where user_id = auth.uid()",
    "create or replace function public.purge_expired_beta_data()",
    "pg_try_advisory_xact_lock",
    "set_config('trainoracle.retention_cleanup', 'AUTHORIZED', true)",
    "insert into public.retention_cleanup_runs",
    "expires_at <= cleanup_started_at",
    "delete_by <= cleanup_started_at",
    "grant execute on function public.purge_expired_beta_data() to service_role",
  ]

  for (const clause of requiredClauses) {
    if (!migration.includes(clause)) throw new Error(`missing server operations clause: ${clause}`)
  }

  if (/grant execute on function public\.set_service_feature_state[^;]+to authenticated;/iu.test(migration)) {
    throw new Error("authenticated users must not change server feature state")
  }
  const defaultValues = migration.slice(
    migration.indexOf("insert into public.service_feature_controls"),
    migration.indexOf("on conflict (feature_key) do nothing"),
  )
  if (/\('(?:ACCOUNT|SYNC|SHARING|PLAN_PROPOSALS|PRODUCT_ANALYTICS)', true,/u.test(defaultValues)) {
    throw new Error("risky server features must default off")
  }
}

describe("server operations migration", () => {
  it("defaults every server feature off and keeps changes service-only", () => {
    const migration = loadMigration()
    assertServerOperationsMigration(migration)

    const defaultValues = migration.slice(
      migration.indexOf("insert into public.service_feature_controls"),
      migration.indexOf("on conflict (feature_key) do nothing"),
    )
    expect(defaultValues.match(/\('(?:ACCOUNT|SYNC|SHARING|PLAN_PROPOSALS|PRODUCT_ANALYTICS)', false,/gu)).toHaveLength(5)
  })

  it("allows analytics withdrawal before any enabled-feature access check", () => {
    const migration = loadMigration()
    const consentFunction = migration.slice(
      migration.indexOf("create or replace function public.set_product_analytics_consent"),
      migration.indexOf("create or replace function public.record_product_analytics_event"),
    )

    expect(consentFunction.indexOf("if not enabled_input then")).toBeGreaterThan(-1)
    expect(consentFunction.indexOf("if not enabled_input then")).toBeLessThan(
      consentFunction.indexOf("if not public.account_network_access_allowed(auth.uid()) then"),
    )
  })

  it.each(featureTriggerCases)("attaches %s to the expected server surface", (triggerName, tableName, feature) => {
    const migration = loadMigration()
    expect(() => assertFeatureTrigger(migration, triggerName, tableName, feature)).not.toThrow()
  })

  it.each(featureTriggerCases)("rejects wrong feature assignment for %s", (triggerName, tableName, feature) => {
    const original = loadMigration()
    const start = original.indexOf(`create trigger ${triggerName}`)
    const end = original.indexOf(";", start) + 1
    const trigger = original.slice(start, end)
    const mutatedTrigger = trigger.replace(
      `public.enforce_service_feature_write('${feature}')`,
      "public.enforce_service_feature_write('WRONG_FEATURE')",
    )
    const mutated = `${original.slice(0, start)}${mutatedTrigger}${original.slice(end)}`

    expect(mutated).not.toBe(original)
    expect(() => assertFeatureTrigger(mutated, triggerName, tableName, feature)).toThrow(/wrong trigger feature/u)
  })

  it("treats ACCOUNT as the master gate for every account-backed server write", () => {
    const migration = loadMigration()
    const writeGuard = migration.slice(
      migration.indexOf("create or replace function public.enforce_service_feature_write"),
      migration.indexOf("revoke all on function public.enforce_service_feature_write"),
    )

    expect(writeGuard).toContain("required_feature <> 'ACCOUNT'")
    expect(writeGuard).toContain("not public.service_feature_enabled('ACCOUNT')")
    expect(writeGuard).toContain("account feature disabled")
  })

  it("gates shared journal reads through sync and current connection authority", () => {
    const migration = loadMigration()
    const sharedJournal = migration.slice(
      migration.indexOf("create or replace function public.list_shared_journal_entries"),
      migration.indexOf("create or replace function public.set_product_analytics_consent"),
    )

    expect(sharedJournal).toContain("public.service_feature_enabled('SYNC')")
    expect(sharedJournal).toContain("public.support_connection_network_access_allowed(connection.id)")
  })

  it("gates plan supporters and legacy access helpers through current server controls", () => {
    const migration = loadMigration()
    const planAccess = migration.slice(
      migration.indexOf("create or replace function public.can_create_plan_proposal"),
      migration.indexOf("create or replace function public.list_shared_journal_entries"),
    )
    const legacySharing = migration.slice(
      migration.indexOf("create or replace function public.can_access_shared_athlete_data"),
      migration.indexOf("create or replace function public.can_create_plan_proposal"),
    )

    expect(planAccess).toContain("public.support_connection_network_access_allowed(connection.id)")
    expect(legacySharing).toContain("public.service_feature_enabled('ACCOUNT')")
    expect(legacySharing).toContain("public.service_feature_enabled('SHARING')")
  })

  it("keeps plan history immutable except during an authorized service cleanup", () => {
    const migration = loadMigration()
    const immutabilityGuard = migration.slice(
      migration.indexOf("create or replace function public.reject_plan_version_mutation"),
      migration.indexOf("drop trigger if exists plan_versions_immutable"),
    )
    const cleanup = migration.slice(
      migration.indexOf("create or replace function public.purge_expired_beta_data"),
    )

    expect(immutabilityGuard).toContain("current_setting('trainoracle.retention_cleanup', true)")
    expect(immutabilityGuard).toContain("auth.jwt() ->> 'role'")
    expect(cleanup).toContain("set_config('trainoracle.retention_cleanup', 'AUTHORIZED', true)")
    expect(cleanup).toContain("service role required")
  })

  it("makes account deletion compatible with plan and guardian history", () => {
    const migration = loadMigration()
    const requiredClauses = [
      "alter column proposed_by drop not null",
      "foreign key (proposed_by) references auth.users (id) on delete set null",
      "foreign key (source_proposal_id) references public.plan_proposals (id) on delete cascade",
      "foreign key (activated_by) references auth.users (id) on delete set null",
      "foreign key (active_plan_version_id) references public.plan_versions (id) on delete cascade",
      "foreign key (proposal_id) references public.plan_proposals (id) on delete cascade",
      "foreign key (plan_version_id) references public.plan_versions (id) on delete cascade",
      "references public.guardian_confirmations (id) on delete set null",
    ]

    for (const clause of requiredClauses) expect(migration).toContain(clause)
  })

  it.each([
    ["sync gate", "public.service_feature_enabled('SYNC')", "true"],
    ["sharing gate", "public.service_feature_enabled('SHARING')", "true"],
    ["plan gate", "public.service_feature_enabled('PLAN_PROPOSALS')", "true"],
    ["analytics gate", "public.service_feature_enabled('PRODUCT_ANALYTICS')", "true"],
    ["cleanup lock", "pg_try_advisory_xact_lock", "false"],
    ["cleanup receipt", "insert into public.retention_cleanup_runs", "perform 1"],
    ["analytics cutoff", "expires_at <= cleanup_started_at", "expires_at <= now()"],
    ["account cutoff", "delete_by <= cleanup_started_at", "delete_by <= now()"],
  ])("rejects hostile mutation: %s", (_label, originalClause, mutation) => {
    const original = loadMigration()
    const mutated = original.replaceAll(originalClause, mutation)

    expect(mutated).not.toBe(original)
    expect(() => assertServerOperationsMigration(mutated)).toThrow(/missing server operations clause/u)
  })
})
