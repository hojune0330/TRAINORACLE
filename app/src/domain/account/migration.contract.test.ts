import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0003_beta_accounts.sql"),
  "utf8",
)
const retentionMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0006_retention_cleanup.sql"),
  "utf8",
)
const deletionActionMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0009_account_deletion_actions.sql"),
  "utf8",
)
const analyticsActionMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0010_product_analytics_actions.sql"),
  "utf8",
)
const analyticsConsentMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0011_product_analytics_consent.sql"),
  "utf8",
)

describe("beta account database boundaries", () => {
  it("separates birth dates, private ciphertext, relationships, proposals, and analytics", () => {
    expect(migration).toContain("create table if not exists public.user_private_profiles")
    expect(migration).toContain("create table if not exists public.encrypted_private_notes")
    expect(migration).toContain("create table if not exists public.support_connections")
    expect(migration).toContain("create table if not exists public.plan_proposals")
    expect(migration).toContain("create table if not exists public.product_analytics_events")
  })

  it("does not give supporters access to encrypted private notes or private profiles", () => {
    expect(migration).not.toMatch(/supporter[^;]+encrypted_private_notes/isu)
    expect(migration).not.toMatch(/supporter[^;]+user_private_profiles/isu)
    expect(migration).toContain("qualification_label text not null default '자격 미확인'")
  })

  it("blocks network data after deletion is requested and keeps 30-day expiry", () => {
    expect(migration).toContain("account_network_access_allowed")
    expect(migration).toContain("interval '30 days'")
    expect(migration).toContain("deletion_requested_at is null")
  })

  it("uses the server clock and blocks direct deletion-request inserts", () => {
    expect(deletionActionMigration).toContain("request_account_deletion")
    expect(deletionActionMigration).toContain("clock_timestamp()")
    expect(deletionActionMigration).toContain("requested + interval '30 days'")
    expect(deletionActionMigration).toContain("revoke insert on table public.account_deletion_requests from authenticated")
    expect(deletionActionMigration).toContain("grant execute on function public.request_account_deletion() to authenticated")
  })

  it("blocks athlete and supporter reads across shared tables after deletion is requested", () => {
    expect(deletionActionMigration).toContain("can_access_shared_athlete_data")
    expect(deletionActionMigration).toMatch(/journal owner or active supporter select[\s\S]+can_access_shared_athlete_data\(user_id\)/u)
    expect(deletionActionMigration).toMatch(/connection participants select[\s\S]+can_access_shared_athlete_data\(athlete_id\)/u)
    expect(deletionActionMigration).toMatch(/proposal participants select[\s\S]+can_access_shared_athlete_data\(athlete_id\)/u)
  })

  it("stores no free-form analytics payload", () => {
    const analyticsTable = migration.slice(
      migration.indexOf("create table if not exists public.product_analytics_events"),
      migration.indexOf("alter table public.product_analytics_events"),
    )
    expect(analyticsTable).not.toMatch(/json|payload|memo|pain|mood/iu)
  })

  it("uses a server-only clock and allowlist for analytics retention", () => {
    expect(analyticsActionMigration).toContain("record_product_analytics_event")
    expect(analyticsActionMigration).toContain("clock_timestamp()")
    expect(analyticsActionMigration).toContain("occurred + interval '30 days'")
    expect(analyticsActionMigration).toContain("analytics_opt_in")
    expect(analyticsActionMigration).toContain("revoke insert on table public.product_analytics_events from authenticated")
  })

  it("provides a service-only cleanup path for 30-day account and analytics retention", () => {
    expect(retentionMigration).toContain("delete from public.product_analytics_events")
    expect(retentionMigration).toContain("delete from auth.users")
    expect(retentionMigration).toContain("delete_by <= now()")
    expect(retentionMigration).toContain("expires_at <= now()")
    expect(retentionMigration).toContain("revoke all on function public.purge_expired_beta_data() from public")
    expect(retentionMigration).toContain("grant execute on function public.purge_expired_beta_data() to service_role")
    expect(retentionMigration).not.toContain("grant execute on function public.purge_expired_beta_data() to authenticated")
  })

  it("changes analytics consent through a separate authenticated action", () => {
    expect(analyticsConsentMigration).toContain("set_product_analytics_consent")
    expect(analyticsConsentMigration).toContain("analytics_opt_in = enabled_input")
    expect(analyticsConsentMigration).toContain("clock_timestamp()")
    expect(analyticsConsentMigration).toContain("delete from public.product_analytics_events")
    expect(analyticsConsentMigration).toContain("user_id = auth.uid()")
    expect(analyticsConsentMigration).toContain("for update")
    expect(analyticsConsentMigration).toContain("revoke insert on table public.user_private_profiles from authenticated")
    expect(analyticsConsentMigration).toContain("grant insert (user_id, birth_date) on table public.user_private_profiles to authenticated")
    expect(analyticsConsentMigration).toContain("revoke update on table public.user_private_profiles from authenticated")
    expect(analyticsConsentMigration).toContain("grant update (birth_date) on table public.user_private_profiles to authenticated")
    expect(analyticsConsentMigration).toContain("revoke all on function public.set_product_analytics_consent(boolean) from public")
    expect(analyticsConsentMigration).toContain("grant execute on function public.set_product_analytics_consent(boolean) to authenticated")
  })
})
