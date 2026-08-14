import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0027_account_legal_consent.sql"),
  "utf8",
)

describe("account legal-consent migration", () => {
  it("records only document versions and the server consent time with the private profile", () => {
    expect(migration).toContain("privacy_policy_version")
    expect(migration).toContain("terms_of_service_version")
    expect(migration).toContain("legal_consented_at")
    expect(migration).toContain("clock_timestamp()")
    expect(migration).not.toMatch(/privacy_policy_url|terms_of_service_url/iu)
  })

  it("makes the prior one-argument beta-claim path fail closed and requires both versions", () => {
    expect(migration).toContain("CONSENT_REQUIRED")
    expect(migration).toContain("privacy_policy_version_input")
    expect(migration).toContain("terms_of_service_version_input")
    expect(migration).toContain("invalid legal consent version")
  })
})
