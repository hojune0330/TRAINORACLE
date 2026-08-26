const ACCOUNT_BACKED_FEATURES = [
  "SYNC",
  "SHARING",
  "PLAN_PROPOSALS",
  "PLAN_BACKUP",
  "PUBLIC_PROFILE",
  "PRODUCT_ANALYTICS",
]

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

function hasPublicConnection(environment) {
  return textValue(environment, "VITE_SUPABASE_URL").startsWith("https://")
    && textValue(environment, "VITE_SUPABASE_ANON_KEY") !== ""
}

function hasPublicLegalDocuments(environment) {
  return textValue(environment, "VITE_PRIVACY_POLICY_URL").startsWith("https://")
    && textValue(environment, "VITE_PRIVACY_POLICY_VERSION") !== ""
    && textValue(environment, "VITE_TERMS_OF_SERVICE_URL").startsWith("https://")
    && textValue(environment, "VITE_TERMS_OF_SERVICE_VERSION") !== ""
}

export function validateHostedReleaseEnvironment(environment) {
  const errors = []
  const accountOpen = isAccountEnabled(environment)
  const connectionReady = hasPublicConnection(environment)
  const phoneAuthOpen = isPhoneAuthEnabled(environment)

  if (accountOpen && !connectionReady) {
    errors.push("ACCOUNT_REQUIRES_PUBLIC_CONNECTION")
  }
  if (accountOpen && !hasPublicLegalDocuments(environment)) {
    errors.push("ACCOUNT_REQUIRES_PUBLIC_LEGAL_DOCUMENTS")
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
