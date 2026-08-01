import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0013_shared_journal_projection.sql"),
  "utf8",
)

function assertSharedProjectionBoundary(sql: string): void {
  expect(sql).toContain("create policy \"journal owner select\"")
  expect(sql).not.toContain("can_access_shared_athlete_data(user_id)")
  expect(sql).toContain("connection.revoked_at is null")
  expect(sql).toContain("connection.season_ends_on >= current_date")
  expect(sql).toContain("shared_fields")
  expect(sql).toContain("jsonb_strip_nulls(jsonb_build_object(")
  expect(sql).toContain("'TRAINING_NOTE' = any(allowed_fields)")
  expect(sql).toContain("journal.entry ->> 'memoPurpose' = 'ANALYZABLE_TRAINING_NOTE'")
  expect(sql).toContain("allowed_fields && array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE']::text[]")
  expect(sql).not.toMatch(/journal\.saved_at,\s*journal\.entry\s*(?:as\s+shared_entry)?\s+from/iu)
  expect(sql).not.toMatch(/^\s*'(?:memo|note|memoPurpose|PRIVATE_MEMO)'\s*,/mu)
  expect(sql).not.toMatch(/jsonb_object_agg|jsonb_each|unnest\(allowed_fields\)|format\(/iu)
}

describe("supporter shared-fields boundary", () => {
  it("projects a redacted journal DTO on the server from shared_fields", () => {
    assertSharedProjectionBoundary(migration)
    expect(migration).toMatch(/returns table \(\s*entry_id text,\s*saved_at text,\s*shared_entry jsonb/iu)
    expect(migration).toContain("journal.saved_at::text")
    expect(migration).toMatch(
      /create\s+(?:or\s+replace\s+)?function[\s\S]+shared_fields[\s\S]+jsonb_build_object/iu,
    )
  })

  it("rejects a mutation that restores direct supporter row reads", () => {
    const mutated = migration.replace(
      "public.account_network_access_allowed(user_id)",
      "public.can_access_shared_athlete_data(user_id)",
    )

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })

  it("rejects a mutation that skips revoked connections", () => {
    const mutated = migration.replace("and connection.revoked_at is null", "")

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })

  it("rejects a mutation that skips season expiry", () => {
    const mutated = migration.replace("and connection.season_ends_on >= current_date", "")

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })

  it("rejects a mutation that returns the raw journal JSON", () => {
    const mutated = migration.replace(
      /jsonb_strip_nulls\(jsonb_build_object\([\s\S]+?\n    \)\)\n  from/u,
      "journal.entry\n  from",
    )

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })

  it("uses literal projection keys so unknown shared_fields are ignored", () => {
    expect(migration).toContain("'TRAINING_RECORD' = any(allowed_fields)")
    expect(migration).toContain("'TRAINING_NOTE' = any(allowed_fields)")
    expect(migration).toContain("'PAIN' = any(allowed_fields)")
    expect(migration).toContain("'MOOD' = any(allowed_fields)")
    expect(migration).toContain("'BODY_STATE' = any(allowed_fields)")
  })

  it("returns no row when a connection has no recognized shared field", () => {
    expect(migration).toContain("allowed_fields && array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE']::text[]")
  })

  it("rejects a mutation that would return metadata for an empty share scope", () => {
    const mutated = migration.replace(
      "if not (allowed_fields && array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE']::text[]) then\n    return;\n  end if;\n\n",
      "",
    )

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })

  it("shares training text only for the explicit training-note purpose", () => {
    expect(migration).toContain("'trainingNote'")
    expect(migration).toContain("journal.entry ->> 'memoPurpose' = 'ANALYZABLE_TRAINING_NOTE'")
    expect(migration).toContain("coalesce(journal.entry -> 'memo', journal.entry -> 'note')")
  })

  it("rejects a mutation that would share private-self-only text", () => {
    const mutated = migration.replace(
      "and journal.entry ->> 'memoPurpose' = 'ANALYZABLE_TRAINING_NOTE'",
      "",
    )

    expect(() => assertSharedProjectionBoundary(mutated)).toThrow()
  })
})
