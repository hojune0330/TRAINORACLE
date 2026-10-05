const ACCOUNT_BACKED_FEATURES = [
  "ACCOUNT_JOURNAL",
  "SYNC",
  "SHARING",
  "PLAN_PROPOSALS",
  "PLAN_BACKUP",
  "PUBLIC_PROFILE",
  "PRODUCT_ANALYTICS",
]

const CURRENT_ACCOUNT_LEGAL_VERSION = "2026-10-05"
const REQUIRED_ACCOUNT_STORAGE_MIGRATION = "0057_purpose_scoped_storage_consent"

function textValue(environment, name) {
  const value = environment[name]
  return typeof value === "string" ? value.trim() : ""
}

function isFeatureEnabled(environment, suffix) {
  return textValue(environment, `VITE_FEATURE_${suffix}`) === "true"
    && textValue(environment, `VITE_KILL_${suffix}`) !== "true"
}

function isAccountEnabled(environment) {
  return textValue(environment, "VITE_ACCOUNT_PUBLIC_ENABLED") === "true"
    && textValue(environment, "VITE_KILL_ACCOUNT") !== "true"
}

function isPhoneAuthEnabled(environment) {
  return textValue(environment, "VITE_PHONE_AUTH_ENABLED") === "true"
    && textValue(environment, "VITE_KILL_PHONE_AUTH") !== "true"
}

function isAuthProviderEnabled(environment, provider) {
  return textValue(environment, `VITE_${provider}_AUTH_ENABLED`) === "true"
    && textValue(environment, `VITE_KILL_${provider}_AUTH`) !== "true"
}

function isSupabasePublicClientKey(value) {
  const key = value.trim()
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(key)) return true
  if (key.startsWith("sb_secret_")) return false
  const parts = key.split(".")
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    return payload?.role === "anon"
  } catch {
    return false
  }
}

function hasPublicConnection(environment) {
  return textValue(environment, "VITE_SUPABASE_URL").startsWith("https://")
    && isSupabasePublicClientKey(textValue(environment, "VITE_SUPABASE_ANON_KEY"))
}

function hasPublicLegalDocuments(environment) {
  return textValue(environment, "VITE_PRIVACY_POLICY_URL").startsWith("https://")
    && textValue(environment, "VITE_PRIVACY_POLICY_VERSION") === CURRENT_ACCOUNT_LEGAL_VERSION
    && textValue(environment, "VITE_TERMS_OF_SERVICE_URL").startsWith("https://")
    && textValue(environment, "VITE_TERMS_OF_SERVICE_VERSION") === CURRENT_ACCOUNT_LEGAL_VERSION
}

export function validateHostedReleaseEnvironment(environment) {
  const errors = []
  const configuredPublicKey = textValue(environment, "VITE_SUPABASE_ANON_KEY")
  const accountOpen = isAccountEnabled(environment)
  const connectionReady = hasPublicConnection(environment)
  const kakaoAuthOpen = isAuthProviderEnabled(environment, "KAKAO")
  const googleAuthOpen = isAuthProviderEnabled(environment, "GOOGLE")
  const emailAuthOpen = isAuthProviderEnabled(environment, "EMAIL")
  const phoneAuthOpen = isPhoneAuthEnabled(environment)

  if (configuredPublicKey !== "" && !isSupabasePublicClientKey(configuredPublicKey)) {
    errors.push("UNSAFE_SUPABASE_PUBLIC_CLIENT_KEY")
  }

  if (accountOpen && !connectionReady) {
    errors.push("ACCOUNT_REQUIRES_PUBLIC_CONNECTION")
  }
  if (accountOpen && !hasPublicLegalDocuments(environment)) {
    errors.push("ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS")
  }
  // Deployment-order acknowledgement only: this does not prove an applied DB migration,
  // a deployed rights endpoint, a dedicated origin, or the DB's separate operations review.
  if (accountOpen && (
    textValue(environment, "VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED") !== "true"
    || textValue(environment, "VITE_ACCOUNT_STORAGE_PRIVACY_MIGRATION") !== REQUIRED_ACCOUNT_STORAGE_MIGRATION
  )) {
    errors.push("ACCOUNT_REQUIRES_STORAGE_PRIVACY_RELEASE_APPROVAL")
  }
  if (isFeatureEnabled(environment, "SHARING")) {
    errors.push("SHARING_PRIVACY_REVIEW_REQUIRED")
  }
  if (kakaoAuthOpen && !accountOpen) {
    errors.push("KAKAO_AUTH_REQUIRES_ACCOUNT")
  }
  if (googleAuthOpen && !accountOpen) {
    errors.push("GOOGLE_AUTH_REQUIRES_ACCOUNT")
  }
  if (emailAuthOpen && !accountOpen) {
    errors.push("EMAIL_AUTH_REQUIRES_ACCOUNT")
  }
  if (emailAuthOpen && textValue(environment, "VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED") !== "true") {
    errors.push("EMAIL_AUTH_REQUIRES_PKCE_OPERATIONS_APPROVAL")
  }
  if (phoneAuthOpen && !accountOpen) {
    errors.push("PHONE_AUTH_REQUIRES_ACCOUNT")
  }
  if (phoneAuthOpen && textValue(environment, "VITE_PHONE_AUTH_OPERATIONS_APPROVED") !== "true") {
    errors.push("PHONE_AUTH_REQUIRES_OPERATIONAL_APPROVAL")
  }

  for (const feature of ACCOUNT_BACKED_FEATURES) {
    if (isFeatureEnabled(environment, feature) && !accountOpen) {
      errors.push(`${feature}_REQUIRES_ACCOUNT`)
    }
  }

  for (const format of ["TCX", "CSV", "JSON", "GPX"]) {
    const feature = `FILE_ANALYSIS_${format}`
    if (!isFeatureEnabled(environment, feature)) continue
    if (!accountOpen) errors.push(`${feature}_REQUIRES_ACCOUNT`)
    if (!isFeatureEnabled(environment, "ACCOUNT_JOURNAL")) {
      errors.push(`${feature}_REQUIRES_ACCOUNT_JOURNAL`)
    }
  }

  if (isFeatureEnabled(environment, "FEEDBACK_BOARD") && !connectionReady) {
    errors.push("FEEDBACK_BOARD_REQUIRES_PUBLIC_CONNECTION")
  }

  return errors
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const errors = validateHostedReleaseEnvironment(process.env)
  if (errors.length > 0) {
    console.error("Hosted release configuration rejected:")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log("Hosted release configuration is coherent.")
  }
}
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
