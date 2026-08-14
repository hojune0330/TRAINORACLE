import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateHostedReleaseEnvironment } from "./validate-hosted-release-env.mjs"

const scriptPath = fileURLToPath(new URL("./validate-hosted-release-env.mjs", import.meta.url))

const connection = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-anon-key",
}

const legalDocuments = {
  VITE_PRIVACY_POLICY_URL: "https://trainoracle.example/privacy",
  VITE_PRIVACY_POLICY_VERSION: "2026-08-14",
  VITE_TERMS_OF_SERVICE_URL: "https://trainoracle.example/terms",
  VITE_TERMS_OF_SERVICE_VERSION: "2026-08-14",
}

test("keeps the local-only release valid when every network feature is closed", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({}), [])
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

test("requires the account gate before opening account-backed features", () => {
  assert.deepEqual(validateHostedReleaseEnvironment({
    ...connection,
    VITE_FEATURE_SYNC: "true",
    VITE_FEATURE_SHARING: "true",
    VITE_FEATURE_PLAN_PROPOSALS: "true",
    VITE_FEATURE_PRODUCT_ANALYTICS: "true",
  }), [
    "SYNC_REQUIRES_ACCOUNT",
    "SHARING_REQUIRES_ACCOUNT",
    "PLAN_PROPOSALS_REQUIRES_ACCOUNT",
    "PRODUCT_ANALYTICS_REQUIRES_ACCOUNT",
  ])
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
