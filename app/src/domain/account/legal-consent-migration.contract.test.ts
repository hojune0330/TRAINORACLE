import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CURRENT_ACCOUNT_LEGAL_VERSION } from "./config"

const migration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0027_account_legal_consent.sql"),
  "utf8",
)
const currentVersionMigration = readFileSync(
  join(process.cwd(), "..", "supabase", "migrations", "0047_current_account_legal_versions.sql"),
  "utf8",
)
const privacyDocument = readFileSync(join(process.cwd(), "public", "legal", "privacy.html"), "utf8")
const termsDocument = readFileSync(join(process.cwd(), "public", "legal", "terms.html"), "utf8")
const hostedReleaseValidator = readFileSync(join(process.cwd(), "scripts", "validate-hosted-release-env.mjs"), "utf8")

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

  it("rejects arbitrary consent versions at the profile write boundary", () => {
    expect(currentVersionMigration).toContain("before insert or update of privacy_policy_version, terms_of_service_version")
    expect(currentVersionMigration).toContain("new.privacy_policy_version is distinct from '2026-08-26'")
    expect(currentVersionMigration).toContain("new.terms_of_service_version is distinct from '2026-08-26'")
    expect(currentVersionMigration).toContain("raise exception 'invalid legal consent version'")
  })

  it("does not grant network access to previously recorded arbitrary versions", () => {
    expect(currentVersionMigration).toContain("profile.privacy_policy_version = '2026-08-26'")
    expect(currentVersionMigration).toContain("profile.terms_of_service_version = '2026-08-26'")
    expect(currentVersionMigration).toContain("profile.birth_date <=")
    expect(currentVersionMigration).toContain("public.athlete_support_access_allowed(target_user)")
  })

  it("uses the versions shown in both published legal documents", () => {
    expect(privacyDocument).toContain(`문서 버전: ${CURRENT_ACCOUNT_LEGAL_VERSION}`)
    expect(termsDocument).toContain(`문서 버전: ${CURRENT_ACCOUNT_LEGAL_VERSION}`)
  })

  it("keeps client, hosted release check, server gate, and both public documents on one version", () => {
    const version = CURRENT_ACCOUNT_LEGAL_VERSION
    expect(hostedReleaseValidator).toContain(`const CURRENT_ACCOUNT_LEGAL_VERSION = "${version}"`)
    expect(currentVersionMigration).toContain(`new.privacy_policy_version is distinct from '${version}'`)
    expect(currentVersionMigration).toContain(`new.terms_of_service_version is distinct from '${version}'`)
    expect(currentVersionMigration).toContain(`profile.privacy_policy_version = '${version}'`)
    expect(currentVersionMigration).toContain(`profile.terms_of_service_version = '${version}'`)
    expect(privacyDocument).toContain(`문서 버전: ${version}`)
    expect(termsDocument).toContain(`문서 버전: ${version}`)
  })
})
