import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "..",
  "supabase",
  "migrations",
  "0017_sync_schema_version.sql",
)

function assertSyncSchemaMigration(migration: string): void {
  const requiredClauses = [
    "create table if not exists public.service_contract_versions",
    "contract_key text primary key",
    "schema_version integer not null check (schema_version >= 1)",
    "values ('JOURNAL_SYNC', 17)",
    "greatest(service_contract_versions.schema_version, excluded.schema_version)",
    "alter table public.service_contract_versions enable row level security",
    "revoke all on table public.service_contract_versions from public",
    "revoke all on table public.service_contract_versions from anon",
    "revoke all on table public.service_contract_versions from authenticated",
    "create or replace function public.get_sync_schema_version()",
    "if auth.uid() is null then",
    "where contract_key = 'JOURNAL_SYNC'",
    "revoke all on function public.get_sync_schema_version() from public",
    "revoke all on function public.get_sync_schema_version() from anon",
    "grant execute on function public.get_sync_schema_version() to authenticated",
  ]

  for (const clause of requiredClauses) {
    if (!migration.includes(clause)) throw new Error(`missing sync schema clause: ${clause}`)
  }
}

describe("journal sync schema version migration", () => {
  it("publishes an authenticated, non-downgradable version 17 contract", () => {
    assertSyncSchemaMigration(readFileSync(migrationPath, "utf8"))
  })

  it.each([
    ["older version", "values ('JOURNAL_SYNC', 17)", "values ('JOURNAL_SYNC', 16)"],
    ["downgrade guard", "greatest(service_contract_versions.schema_version, excluded.schema_version)", "excluded.schema_version"],
    ["direct table denial", "revoke all on table public.service_contract_versions from authenticated", "grant select on table public.service_contract_versions to authenticated"],
    ["anonymous denial", "revoke all on function public.get_sync_schema_version() from anon", "grant execute on function public.get_sync_schema_version() to anon"],
    ["authentication check", "if auth.uid() is null then", "if false then"],
  ])("rejects hostile mutation: %s", (_label, originalClause, mutation) => {
    const original = readFileSync(migrationPath, "utf8")
    const mutated = original.replace(originalClause, mutation)

    expect(mutated).not.toBe(original)
    expect(() => assertSyncSchemaMigration(mutated)).toThrow(/missing sync schema clause/u)
  })
})
