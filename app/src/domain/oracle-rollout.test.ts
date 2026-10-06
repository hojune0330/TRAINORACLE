import { expect, it } from "vitest"
import { oracleV2FeatureEnabled } from "./oracle-rollout"

it("enables the approved guest Oracle by default without account settings", () => {
  const env = Object.freeze({ VITE_ACCOUNT_PUBLIC_ENABLED: "false", VITE_KILL_ACCOUNT: "true" })
  expect(oracleV2FeatureEnabled(env)).toBe(true)
  expect(env).toEqual({ VITE_ACCOUNT_PUBLIC_ENABLED: "false", VITE_KILL_ACCOUNT: "true" })
})

it.each([undefined, "true"])("the kill switch closes Oracle even with rollout %s", rollout => {
  expect(oracleV2FeatureEnabled({ VITE_FEATURE_ORACLE_V2: rollout, VITE_KILL_ORACLE_V2: "true" })).toBe(false)
})

it.each(["false", "", "1", "TRUE", null, true])("an explicit non-enabled value %s keeps the V1 fallback", rollout => {
  expect(oracleV2FeatureEnabled({ VITE_FEATURE_ORACLE_V2: rollout })).toBe(false)
})

it("retains an explicit enabled deployment without inventing account or sharing approval", () => {
  const env = Object.freeze({ VITE_FEATURE_ORACLE_V2: "true" })
  expect(oracleV2FeatureEnabled(env)).toBe(true)
  expect(Object.keys(env)).toEqual(["VITE_FEATURE_ORACLE_V2"])
})

it("does not implicitly activate V2 account paths when accounts are opened later", () => {
  expect(oracleV2FeatureEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: "true" })).toBe(false)
  expect(oracleV2FeatureEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_KILL_ACCOUNT: "true" })).toBe(true)
  expect(oracleV2FeatureEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_FEATURE_ORACLE_V2: "true" })).toBe(true)
})
