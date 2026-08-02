import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0021_private_feedback_board.sql"),
  "utf8",
)
const operatorMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0022_feedback_board_operator_controls.sql"),
  "utf8",
)
const repairMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0023_feedback_submit_conflict_repair.sql"),
  "utf8",
)
const accessRepairMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0024_feedback_comment_access_error.sql"),
  "utf8",
)
const abuseAndRetentionMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0025_feedback_board_abuse_retention.sql"),
  "utf8",
)
const expiryBoundaryMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0026_feedback_board_expiry_boundary.sql"),
  "utf8",
)

describe("private feedback board migration", () => {
  it("exposes only receipt-token RPCs to anonymous users", () => {
    expect(migration).toContain("submit_feedback_thread")
    expect(migration).toContain("list_my_feedback_threads")
    expect(migration).toContain("append_feedback_comment")
    expect(migration).toContain("grant execute on function public.submit_feedback_thread")
    expect(migration).toContain("revoke all on table public.feedback_threads from anon")
    expect(migration).toContain("revoke all on table public.feedback_comments from anon")
  })

  it("keeps the board off until both operator switches are open", () => {
    expect(migration).toContain("'FEEDBACK_BOARD', false, 'INITIAL_SAFE_DEFAULT'")
    expect(migration).toContain("service_feature_enabled('FEEDBACK_BOARD')")
  })

  it("stores only a digest of the device receipt token", () => {
    expect(migration).toContain("client_token_hash")
    expect(migration).toContain("extensions.digest")
    expect(migration).not.toMatch(/client_token\s+text\s+not null/iu)
  })

  it("keeps operator replies and cleanup behind the service role", () => {
    expect(operatorMigration).toContain("reply_to_feedback_thread")
    expect(operatorMigration).toContain("delete_feedback_thread_for_operations")
    expect(operatorMigration).toContain("auth.jwt() ->> 'role'")
    expect(operatorMigration).toContain("<> 'service_role'")
    expect(operatorMigration).not.toContain("to anon")
    expect(operatorMigration).not.toContain("to authenticated")
  })

  it("lets only the service operator discover receipt-owned threads before replying", () => {
    expect(abuseAndRetentionMigration).toContain("list_feedback_threads_for_operator")
    expect(abuseAndRetentionMigration).toContain("coalesce(auth.jwt() ->> 'role', '') <> 'service_role'")
    expect(abuseAndRetentionMigration).toContain("jsonb_agg")
    expect(abuseAndRetentionMigration).not.toMatch(
      /grant execute on function public\.list_feedback_threads_for_operator[^\n]*to (anon|authenticated)/iu,
    )
  })

  it("applies the same serialized comment cap to operator replies", () => {
    expect(abuseAndRetentionMigration).toContain("create or replace function public.reply_to_feedback_thread")
    expect(abuseAndRetentionMigration).toContain("FEEDBACK_COMMENT_THREAD")
    expect(abuseAndRetentionMigration).toContain("feedback comment limit reached")
  })

  it("pins the idempotency conflict target without a PL/pgSQL name collision", () => {
    expect(repairMigration).toContain("on conflict on constraint feedback_comments_thread_id_client_comment_id_key")
    expect(repairMigration).not.toContain("on conflict (thread_id, client_comment_id)")
  })

  it("rejects a foreign receipt without surfacing an internal server error", () => {
    expect(accessRepairMigration).toContain("using errcode = '42501'")
    expect(accessRepairMigration).not.toContain("errcode = 'P0002'")
  })

  it("bounds rotating-receipt abuse with serialized global quotas", () => {
    expect(abuseAndRetentionMigration).toContain("TRAINORACLE_FEEDBACK_GLOBAL")
    expect(abuseAndRetentionMigration).toMatch(/created_at > clock_timestamp\(\) - interval '1 hour'.*>= 60/isu)
    expect(abuseAndRetentionMigration).toMatch(/created_at > clock_timestamp\(\) - interval '24 hours'.*>= 300/isu)
  })

  it("expires feedback and lets a receipt holder delete only their own thread", () => {
    expect(abuseAndRetentionMigration).toContain("expires_at")
    expect(abuseAndRetentionMigration).toContain("purge_expired_feedback_threads")
    expect(abuseAndRetentionMigration).toContain("delete_my_feedback_thread")
    expect(abuseAndRetentionMigration).toContain("thread.client_token_hash = token_hash")
    expect(abuseAndRetentionMigration).toContain("grant execute on function public.delete_my_feedback_thread")
  })

  it("serializes comment count enforcement per thread", () => {
    expect(abuseAndRetentionMigration).toContain("FEEDBACK_COMMENT_THREAD")
    expect(abuseAndRetentionMigration).toContain("pg_advisory_xact_lock")
  })

  it("hides expired threads from receipt owners and prevents resurrection", () => {
    expect(expiryBoundaryMigration).toContain("create or replace function public.list_my_feedback_threads")
    expect(expiryBoundaryMigration).toContain("create or replace function public.append_feedback_comment")
    expect(expiryBoundaryMigration).toContain("create or replace function public.reply_to_feedback_thread")
    expect(expiryBoundaryMigration.match(/expires_at > clock_timestamp\(\)/gu)).toHaveLength(3)
  })
})
