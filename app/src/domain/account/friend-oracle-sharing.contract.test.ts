import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/0031_friend_oracle_comparison.sql"),
  "utf8",
)

describe("friend oracle sharing migration", () => {
  it("requires an explicit public profile and comparison switch", () => {
    expect(migration).toContain("is_enabled")
    expect(migration).toContain("profile.is_public")
    expect(migration).toContain("public.public_profile_sharing_enabled()")
    expect(migration).toContain("auth.uid() = user_id")
  })

  it("allows only bounded aggregate snapshot keys", () => {
    expect(migration).toContain("oracle_comparison_snapshot_is_safe")
    expect(migration).toContain("energySessionCounts")
    expect(migration).not.toMatch(/journal_entries|memo|pain|symptom|sleep|location|contact/iu)
  })

  it("keeps withdrawal available to the owner", () => {
    expect(migration).toContain('for delete using (auth.uid() = user_id)')
  })
})
