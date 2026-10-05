import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateHostedReleaseEnvironment } from "./validate-hosted-release-env.mjs"

const scriptPath = fileURLToPath(new URL("./validate-hosted-release-env.mjs", import.meta.url))

const connection = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.synthetic-signature",
}

const legalDocuments = {
  VITE_PRIVACY_POLICY_URL: "https://trainoracle.example/privacy",
  VITE_PRIVACY_POLICY_VERSION: "2026-08-26",
  VITE_TERMS_OF_SERVICE_URL: "https://trainoracle.example/terms",
  VITE_TERMS_OF_SERVICE_VERSION: "2026-08-26",
}

test("keeps the local-only release valid when every network feature is closed", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({}), [])
})

for (const format of ["TCX", "CSV", "JSON", "GPX"]) {
  test(`${format} analysis requires an account and account journal independently`, () => {
    const flag = `VITE_FEATURE_FILE_ANALYSIS_${format}`
    assert.deepEqual(validateHostedReleaseEnvironment({ [flag]: "true" }), [
      `FILE_ANALYSIS_${format}_REQUIRES_ACCOUNT`, `FILE_ANALYSIS_${format}_REQUIRES_ACCOUNT_JOURNAL`,
    ])
    const account = { ...connection, ...legalDocuments, VITE_ACCOUNT_PUBLIC_ENABLED: "true" }
    assert.deepEqual(validateHostedReleaseEnvironment({ ...account, [flag]: "true" }), [
      `FILE_ANALYSIS_${format}_REQUIRES_ACCOUNT_JOURNAL`,
    ])
    assert.deepEqual(validateHostedReleaseEnvironment({ ...account, [flag]: "true", VITE_FEATURE_ACCOUNT_JOURNAL: "true" }), [])
    assert.deepEqual(validateHostedReleaseEnvironment({ ...account, [flag]: "true", VITE_FEATURE_ACCOUNT_JOURNAL: "true", VITE_KILL_ACCOUNT_JOURNAL: "true" }), [
      `FILE_ANALYSIS_${format}_REQUIRES_ACCOUNT_JOURNAL`,
    ])
    assert.deepEqual(validateHostedReleaseEnvironment({ [flag]: "true", [`VITE_KILL_FILE_ANALYSIS_${format}`]: "true" }), [])
  })
}

test("account journal cannot be published without account access", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({ VITE_FEATURE_ACCOUNT_JOURNAL: "true" }), ["ACCOUNT_JOURNAL_REQUIRES_ACCOUNT"])
  assert.deepEqual(validateHostedReleaseEnvironment({ VITE_FEATURE_ACCOUNT_JOURNAL: "true", VITE_KILL_ACCOUNT_JOURNAL: "true" }), [])
  assert.deepEqual(validateHostedReleaseEnvironment({ ...connection, ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_FEATURE_ACCOUNT_JOURNAL: "true" }), [])
})

test("requires a public client connection before opening accounts", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
  }), [
    "ACCOUNT_REQUIRES_PUBLIC_CONNECTION",
    "ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS",
  ])
})

test("requires public legal documents and versions before opening accounts", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
  }), ["ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS"])
})

test("rejects an older legal version before an account release", () => {
  const account = { ...connection, ...legalDocuments, VITE_ACCOUNT_PUBLIC_ENABLED: "true" }
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...account, VITE_PRIVACY_POLICY_VERSION: "2026-08-25",
  }), ["ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS"])
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...account, VITE_TERMS_OF_SERVICE_VERSION: "2026-08-25",
  }), ["ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS"])
})

test("keeps direct recipient sharing closed pending its privacy review", () => {
  const account = { ...connection, ...legalDocuments, VITE_ACCOUNT_PUBLIC_ENABLED: "true" }
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...account, VITE_FEATURE_SHARING: "true",
  }), ["SHARING_PRIVACY_REVIEW_REQUIRED"])
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...account, VITE_FEATURE_SHARING: "true", VITE_KILL_SHARING: "true",
  }), [])
})

test("requires the account gate before opening account-backed features", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    VITE_FEATURE_SYNC: "true",
    VITE_FEATURE_SHARING: "true",
    VITE_FEATURE_PLAN_PROPOSALS: "true",
    VITE_FEATURE_PLAN_BACKUP: "true",
    VITE_FEATURE_PUBLIC_PROFILE: "true",
    VITE_FEATURE_PRODUCT_ANALYTICS: "true",
  }), [
    "SHARING_PRIVACY_REVIEW_REQUIRED",
    "SYNC_REQUIRES_ACCOUNT",
    "SHARING_REQUIRES_ACCOUNT",
    "PLAN_PROPOSALS_REQUIRES_ACCOUNT",
    "PLAN_BACKUP_REQUIRES_ACCOUNT",
    "PUBLIC_PROFILE_REQUIRES_ACCOUNT",
    "PRODUCT_ANALYTICS_REQUIRES_ACCOUNT",
  ])
})

test("keeps phone auth closed without both the account and operations approval", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_PHONE_AUTH_ENABLED: "true",
  }), [
    "PHONE_AUTH_REQUIRES_ACCOUNT",
    "PHONE_AUTH_REQUIRES_OPERATIONAL_APPROVAL",
  ])

  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_PHONE_AUTH_ENABLED: "true",
  }), ["PHONE_AUTH_REQUIRES_OPERATIONAL_APPROVAL"])
})

test("requires the account gate before releasing any social provider", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_KAKAO_AUTH_ENABLED: "true",
    VITE_GOOGLE_AUTH_ENABLED: "true",
  }), [
    "KAKAO_AUTH_REQUIRES_ACCOUNT",
    "GOOGLE_AUTH_REQUIRES_ACCOUNT",
  ])
})

test("requires PKCE callback and hosted-template approval before releasing email", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_EMAIL_AUTH_ENABLED: "true",
  }), ["EMAIL_AUTH_REQUIRES_PKCE_OPERATIONS_APPROVAL"])

  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_EMAIL_AUTH_ENABLED: "true",
  }), [
    "EMAIL_AUTH_REQUIRES_ACCOUNT",
    "EMAIL_AUTH_REQUIRES_PKCE_OPERATIONS_APPROVAL",
  ])
})

test("accepts separately released Google and PKCE-ready email providers", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_GOOGLE_AUTH_ENABLED: "true",
    VITE_EMAIL_AUTH_ENABLED: "true",
    VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED: "true",
  }), [])
})

test("provider kill switches close their own release without blocking the deploy", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_GOOGLE_AUTH_ENABLED: "true",
    VITE_KILL_GOOGLE_AUTH: "true",
    VITE_EMAIL_AUTH_ENABLED: "true",
    VITE_KILL_EMAIL_AUTH: "true",
    VITE_KAKAO_AUTH_ENABLED: "true",
    VITE_KILL_KAKAO_AUTH: "true",
  }), [])
})

test("allows phone auth only after its separate operations approval", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_PHONE_AUTH_ENABLED: "true",
    VITE_PHONE_AUTH_OPERATIONS_APPROVED: "true",
  }), [])
})

test("allows an independently released feedback board with a valid public connection", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    VITE_FEATURE_FEEDBACK_BOARD: "true",
  }), [])
})

test("lets an emergency kill switch close a feature without blocking deployment", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_FEATURE_SYNC: "true",
    VITE_KILL_SYNC: "true",
  }), [])
})

test("uses the account emergency switch instead of inventing an account-public switch", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_KILL_ACCOUNT: "true",
  }), [])
})

test("accepts a staged account and sync release without exposing configuration values", () => {
  const errors = validateHostedReleaseEnvironment({
    ...connection,
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_FEATURE_SYNC: "true",
  })

  assert.deepEqual(errors, [])
  assert.equal(errors.join(" ").includes(connection.VITE_SUPABASE_ANON_KEY), false)
})

test("fails the executable deployment check without echoing a configured key", () => {
  const key = "must-not-appear"
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_SUPABASE_ANON_KEY: key,
      VITE_SUPABASE_URL: "",
    },
    encoding: "utf8",
  })

  const output = `${result.stdout}${result.stderr}`
  assert.equal(result.status, 1)
  assert.match(output, /ACCOUNT_REQUIRES_PUBLIC_CONNECTION/u)
  assert.equal(output.includes(key), false)
})

test("rejects secret and service-role keys without echoing them", () => {
  for (const key of [
    "sb_secret_this_must_never_reach_a_browser_bundle",
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.synthetic-signature",
  ]) {
    const errors = validateHostedReleaseEnvironment({
      ...legalDocuments,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: key,
    })
    assert.deepEqual(errors, ["UNSAFE_SUPABASE_PUBLIC_CLIENT_KEY", "ACCOUNT_REQUIRES_PUBLIC_CONNECTION"])
    assert.equal(errors.join(" ").includes(key), false)
  }
})

test("accepts the new publishable-key shape for browser clients", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...legalDocuments,
    VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_synthetic_public_key_123456",
  }), [])
})
