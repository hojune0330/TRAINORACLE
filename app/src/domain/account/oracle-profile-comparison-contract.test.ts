import { expect, it } from "vitest"
import { emptyOracleV2Document } from "./account-oracle-v2-schema"
import { makeOracleProfileRevision } from "../oracle-profile-snapshot"
import { comparePermittedProfileAnswers, profileComparisonRequestSchema, profileComparisonExportText } from "./oracle-profile-comparison-contract"

function document(answers: unknown) {
  const value = emptyOracleV2Document()
  value.data.current = makeOracleProfileRevision({ revision: 1, answeredAt: "2026-10-04T00:00:00.000Z", answers })
  return value
}
const grant = { profileRevision: 1, questionVersion: "ORACLE_QUESTIONS_V2_1", scoreVersion: "SELF_RESPONSE_INDEX_V1", fields: ["CHALLENGE_1", "CHALLENGE_2", "SOCIAL_1"] }
it("compares only bilateral numeric selected answers; unknowns are not matches or zero", () => {
  const own = document({ CHALLENGE_1: 1, CHALLENGE_2: 2, SOCIAL_1: "UNKNOWN", WE_1: 5 })
  const peer = document({ CHALLENGE_1: 1, SOCIAL_1: "UNKNOWN", WE_1: 5 })
  const result = comparePermittedProfileAnswers(own, peer, { self: grant, peer: grant })
  expect(result).toMatchObject({ comparedCount: 1, matchingCount: 1, rows: [{ questionId: "CHALLENGE_1", same: true }] })
  expect(profileComparisonExportText(result)).not.toMatch(/WE_1|UNKNOWN|%/u)
  expect(comparePermittedProfileAnswers(document({}), document({}), { self: grant, peer: grant }).comparedCount).toBe(0)
})
it("requires current active matching versions and never reads historical snapshots", () => {
  const own = document({ CHALLENGE_1: 1 })
  expect(() => comparePermittedProfileAnswers(own, own, { self: grant, peer: { ...grant, questionVersion: "OLD" } })).toThrow()
  expect(() => comparePermittedProfileAnswers(own, own, { self: grant, peer: { ...grant, scoreVersion: "OLD" } })).toThrow()
  expect(() => comparePermittedProfileAnswers(own, own, { self: grant, peer: { ...grant, profileRevision: 2 } })).toThrow()
  expect(() => comparePermittedProfileAnswers({ ...own, data: { ...own.data, status: "DELETED" } }, own, { self: grant, peer: grant })).toThrow()
  expect(() => comparePermittedProfileAnswers({ ...own, rawmemo: "PRIVATE" }, own, { self: grant, peer: grant })).toThrow()
})
it("rejects unselected fields, extra owner authority, internal gateway actions and raw memo", () => {
  const id = "a1111111-1111-4111-8111-111111111111"
  expect(profileComparisonRequestSchema.safeParse({ action: "compare", comparisonId: id }).success).toBe(true)
  for (const input of [
    { action: "source", comparisonId: id }, { action: "verify", comparisonId: id },
    { action: "compare", comparisonId: id, ownerId: id }, { action: "compare", comparisonId: id, rawmemo: "PRIVATE" },
    { action: "allowExternal", comparisonId: id, fields: ["rawmemo"], expiresAt: "2026-10-05T00:00:00.000Z" },
  ]) expect(profileComparisonRequestSchema.safeParse(input).success).toBe(false)
})
