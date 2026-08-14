const ACCOUNT_BACKED_FEATURES = [
  "SYNC",
  "SHARING",
  "PLAN_PROPOSALS",
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

function hasPublicConnection(environment) {
  return textValue(environment, "VITE_SUPABASE_URL").startsWith("https://")
    && textValue(environment, "VITE_SUPABASE_ANON_KEY") !== ""
}

export function validateHostedReleaseEnvironment(environment) {
  const errors = []
  const accountOpen = isAccountEnabled(environment)
  const connectionReady = hasPublicConnection(environment)

  if (accountOpen && !connectionReady) {
    errors.push("ACCOUNT_REQUIRES_PUBLIC_CONNECTION")
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
