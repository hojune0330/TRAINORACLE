export type ProductFeatures = {
  readonly sync: boolean
  readonly sharing: boolean
  readonly planProposals: boolean
  readonly experimentalFatigue: boolean
  readonly decorationShop: boolean
  readonly productAnalytics: boolean
  readonly feedbackBoard: boolean
}

const SAFE_DEFAULTS: ProductFeatures = {
  sync: false,
  sharing: false,
  planProposals: false,
  experimentalFatigue: false,
  decorationShop: true,
  productAnalytics: false,
  feedbackBoard: false,
}

function isTrue(env: Readonly<Record<string, unknown>>, key: string): boolean {
  return env[key] === "true"
}

function enabled(
  env: Readonly<Record<string, unknown>>,
  suffix: string,
  defaultValue = false,
): boolean {
  const opened = defaultValue || isTrue(env, `VITE_FEATURE_${suffix}`)
  return opened && !isTrue(env, `VITE_KILL_${suffix}`)
}

export function resolveProductFeatures(env: Readonly<Record<string, unknown>>): ProductFeatures {
  return {
    sync: enabled(env, "SYNC"),
    sharing: enabled(env, "SHARING"),
    planProposals: enabled(env, "PLAN_PROPOSALS"),
    experimentalFatigue: enabled(env, "EXPERIMENTAL_FATIGUE"),
    decorationShop: enabled(env, "DECORATION_SHOP", SAFE_DEFAULTS.decorationShop),
    productAnalytics: enabled(env, "PRODUCT_ANALYTICS"),
    feedbackBoard: enabled(env, "FEEDBACK_BOARD"),
  }
}

export function productFeatures(): ProductFeatures {
  return resolveProductFeatures(import.meta.env)
}
