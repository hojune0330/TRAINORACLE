import { describe, expect, it } from "vitest"
import {
  deriveProviderDataLineage, evaluateProviderDataUse, parseProviderDataLineage, providerLineageFingerprint,
  type ProviderDataGrant, type ProviderDataLineage,
} from "./provider-data-rights"

const now = "2026-10-30T00:00:00Z"
function lineage(patch: Partial<ProviderDataLineage["sources"][number]> = {}): ProviderDataLineage {
  return { schemaVersion: "PROVIDER_DATA_LINEAGE_V1", sources: [{
    sourceId: "synthetic-garmin-record", originProvider: "GARMIN", transport: "PROVIDER_API", assurance: "PROVIDER_VERIFIED", ...patch,
  }], fieldSources: { distanceKm: [patch.sourceId ?? "synthetic-garmin-record"], durationMin: [patch.sourceId ?? "synthetic-garmin-record"] } }
}
const grant: ProviderDataGrant = {
  grantId: "synthetic-approval-control", originProvider: "GARMIN", applicationId: "TRAINORACLE",
  purpose: "SELF_HOSTED_INFERENCE", hosting: "COMPANY_SELF_HOSTED", approvedFields: ["distanceKm", "durationMin"],
  approvedTransports: ["PROVIDER_API"], validFrom: "2026-10-29T00:00:00Z", validUntil: "2026-11-30T00:00:00Z",
  active: true, evidenceReference: "synthetic-test-only", noTraining: true, retention: "REQUEST_ONLY",
}
const request = () => ({ lineage: lineage(), requestedFields: ["distanceKm", "durationMin"] as const,
  purpose: "SELF_HOSTED_INFERENCE", hosting: "COMPANY_SELF_HOSTED", consentActive: true, grants: [grant], now })

describe("provider data use boundary", () => {
  it("allows a complete authenticated server policy control with narrowly scoped current permission", () => {
    expect(evaluateProviderDataUse(request())).toEqual({ allowed: true,
      grantIds: ["synthetic-approval-control"], originProviders: ["GARMIN"] })
  })
  it("does not treat company hosting, file confirmation or consent as provider permission", () => {
    expect(evaluateProviderDataUse({ ...request(), grants: [] })).toEqual({ allowed: false, reason: "PROVIDER_PERMISSION_REQUIRED" })
    expect(evaluateProviderDataUse({ ...request(), consentActive: false })).toEqual({ allowed: false, reason: "CONSENT_REQUIRED" })
  })
  it.each(["FILE_UPLOAD", "HEALTHKIT", "HEALTH_CONNECT"] as const)("retains Garmin obligations through %s", transport => {
    const input = { ...request(), lineage: lineage({ transport }) }
    expect(evaluateProviderDataUse(input).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...input, grants: [{ ...grant, approvedTransports: [transport] }] }).allowed).toBe(true)
    expect(evaluateProviderDataUse({ ...input, grants: [{ ...grant, originProvider: "APPLE", approvedTransports: [transport] }] }).allowed).toBe(false)
  })
  it.each([
    { validUntil: now }, { validFrom: "2026-10-31T00:00:00Z" }, { active: false },
    { approvedFields: ["distanceKm"] }, { applicationId: "ANOTHER_APP" }, { retention: "FOREVER" },
    { noTraining: false }, { evidenceReference: "" }, { purpose: "TRAINING" }, { hosting: "EXTERNAL_API" },
  ])("denies grants outside their actual scope: %j", patch => {
    expect(evaluateProviderDataUse({ ...request(), grants: [{ ...grant, ...patch }] }).allowed).toBe(false)
  })
  it("cannot elevate legacy or declared provider origins", () => {
    expect(evaluateProviderDataUse({ ...request(), lineage: undefined })).toEqual({ allowed: false, reason: "MISSING_LINEAGE" })
    expect(evaluateProviderDataUse({ ...request(), lineage: lineage({ originProvider: "UNKNOWN" }) })).toEqual({ allowed: false, reason: "UNKNOWN_ORIGIN" })
    expect(evaluateProviderDataUse({ ...request(), lineage: lineage({ assurance: "USER_DECLARED" }) })).toEqual({ allowed: false, reason: "UNVERIFIED_ORIGIN" })
  })
  it("requires every requested field and never grants training or external inference", () => {
    expect(evaluateProviderDataUse({ ...request(), requestedFields: ["summary"] }).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...request(), requestedFields: [] }).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...request(), purpose: "MODEL_EVALUATION" }).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...request(), hosting: "EXTERNAL_API" }).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...request(), now: "invalid" }).allowed).toBe(false)
  })
  it("accepts independent direct input under consent but rejects relabelled uploaded user data", () => {
    const input = { ...request(), lineage: lineage({ originProvider: "USER", transport: "DIRECT_INPUT", assurance: "USER_DECLARED" }), grants: [] }
    expect(evaluateProviderDataUse(input)).toEqual({ allowed: true, grantIds: [], originProviders: ["USER"] })
    expect(evaluateProviderDataUse({ ...input, lineage: lineage({ originProvider: "USER", transport: "FILE_UPLOAD" }) }).allowed).toBe(false)
  })
})

describe("derivative lineage", () => {
  it("keeps every source for a mixed-origin summary and requires every provider permission", () => {
    const garmin = lineage(), coros = lineage({ sourceId: "synthetic-coros", originProvider: "COROS" })
    const combined = deriveProviderDataLineage([
      { lineage: garmin, fields: ["distanceKm"] }, { lineage: coros, fields: ["durationMin"] },
    ], ["summary", "recommendation"])
    expect(combined?.sources.map(source => source.originProvider)).toEqual(["GARMIN", "COROS"])
    expect(combined?.fieldSources.summary).toEqual(["synthetic-garmin-record", "synthetic-coros"])
    expect(combined?.fieldDependencies?.summary).toEqual([
      { sourceId: "synthetic-garmin-record", fields: ["distanceKm"] }, { sourceId: "synthetic-coros", fields: ["durationMin"] },
    ])
    const input = { ...request(), lineage: combined, requestedFields: ["summary"] as const,
      grants: [{ ...grant, approvedFields: ["summary", "distanceKm"] }] }
    expect(evaluateProviderDataUse(input).allowed).toBe(false)
    expect(evaluateProviderDataUse({ ...input, grants: [...input.grants,
      { ...grant, grantId: "synthetic-coros-grant", originProvider: "COROS", approvedFields: ["summary", "durationMin"] }] }).allowed).toBe(true)
    expect(evaluateProviderDataUse({ ...input, grants: [...input.grants,
      { ...grant, grantId: "synthetic-coros-grant", originProvider: "COROS", approvedFields: ["summary"] }] }).allowed).toBe(false)
    const nested = deriveProviderDataLineage([{ lineage: combined, fields: ["summary"] }], ["recommendation"])
    expect(nested?.fieldDependencies?.recommendation).toEqual(combined?.fieldDependencies?.summary)
  })
  it("does not remove an unknown source when combining with permitted sources", () => {
    const mixed = deriveProviderDataLineage([
      { lineage: lineage(), fields: ["distanceKm"] },
      { lineage: lineage({ sourceId: "legacy-unknown", originProvider: "UNKNOWN" }), fields: ["distanceKm"] },
    ], ["summary"])
    expect(evaluateProviderDataUse({ ...request(), lineage: mixed, requestedFields: ["summary"] }).allowed).toBe(false)
  })
  it("fails instead of inventing dependencies or silently choosing contradictory source claims", () => {
    expect(deriveProviderDataLineage([{ lineage: lineage(), fields: ["summary"] }], ["recommendation"])).toBeNull()
    expect(deriveProviderDataLineage([{ lineage: undefined, fields: ["distanceKm"] }], ["summary"])).toBeNull()
    expect(deriveProviderDataLineage([
      { lineage: lineage(), fields: ["distanceKm"] },
      { lineage: lineage({ originProvider: "USER" }), fields: ["durationMin"] },
    ], ["summary"])).toBeNull()
  })
  it("rejects missing references, duplicates and private metadata at the schema boundary", () => {
    const value = lineage()
    expect(parseProviderDataLineage({ ...value, sources: [...value.sources, ...value.sources] })).toBeNull()
    expect(parseProviderDataLineage({ ...value, fieldSources: { distanceKm: ["unknown-source"] } })).toBeNull()
    expect(parseProviderDataLineage({ ...value, fieldSources: { memo: value.fieldSources.distanceKm } })).toBeNull()
    expect(parseProviderDataLineage({ ...value, sources: [{ ...value.sources[0], token: "PRIVATE_SENTINEL" }] })).toBeNull()
    expect(parseProviderDataLineage({ ...value, grantIds: [grant.grantId] })).toBeNull()
    expect(parseProviderDataLineage({ ...value, fieldSources: { summary: ["synthetic-garmin-record"] } })).toBeNull()
  })
  it("has stable order-independent identity while preserving changes of original provider", () => {
    const value = deriveProviderDataLineage([
      { lineage: lineage(), fields: ["distanceKm"] },
      { lineage: lineage({ sourceId: "coros", originProvider: "COROS" }), fields: ["distanceKm"] },
    ], ["summary"])!
    expect(providerLineageFingerprint({ ...value, sources: [...value.sources].reverse(),
      fieldSources: { summary: [...value.fieldSources.summary!].reverse() } })).toBe(providerLineageFingerprint(value))
    expect(providerLineageFingerprint(lineage({ originProvider: "COROS" }))).not.toBe(providerLineageFingerprint(lineage()))
  })
})
