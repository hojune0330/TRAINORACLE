/**
 * Owner-approved canonical guest rollout, 2026-10-06.
 * This chooses the Oracle UI only; account, consent, storage and sharing gates
 * remain independent. Explicit holds and the kill switch still take priority.
 */
export function oracleV2FeatureEnabled(env: Readonly<Record<string, unknown>>): boolean {
  const rollout = env.VITE_FEATURE_ORACLE_V2
  const accountOpen = env.VITE_ACCOUNT_PUBLIC_ENABLED === "true" && env.VITE_KILL_ACCOUNT !== "true"
  const enabled = rollout === "true" || (rollout === undefined && !accountOpen)
  return enabled && env.VITE_KILL_ORACLE_V2 !== "true"
}
