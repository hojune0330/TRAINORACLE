import { beforeEach, describe, expect, it, vi } from "vitest"
import { oracleComparisonSnapshotSchema, deriveFriendRunningOracle } from "../friend-running-oracle"

const runtime = vi.hoisted(() => ({ payload: {} as unknown, enabled: true, writes: vi.fn() }))
const owner = "00000000-0000-4000-8000-000000000001"
vi.mock("../product-features", () => ({ productFeatures: () => ({ publicProfile: true }) }))
vi.mock("./supabase-client", () => ({
  supabase: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "00000000-0000-4000-8000-000000000001" } } } }) },
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ error: null, data: table === "public_athlete_profiles"
          ? { user_id: "00000000-0000-4000-8000-000000000001", handle: "runner", display_name: "Runner", profile_tag: "ENJOYING_RUNNING", is_public: true }
          : { snapshot_payload: runtime.payload, is_enabled: runtime.enabled } }),
        upsert: runtime.writes,
      }
      return query
    },
  }),
}))

import { loadPublicProfile } from "./public-profile"
import { loadOwnOracleComparisonSnapshot, loadPublicOracleComparisonSnapshot, saveOwnOracleComparisonSnapshot } from "./oracle-comparison-sharing"

function snapshot(distance: number) {
  return { schemaVersion: 1, sharedFields: ["BEST_RECORD"], record: { eventDistanceM: distance, bestSeconds: 5400 },
    recent8WeekDistanceKm: null, structuredSessionCount: null, energySessionCounts: [] }
}
beforeEach(() => {
  runtime.payload = snapshot(21097.5)
  runtime.enabled = true
  runtime.writes.mockReset().mockResolvedValue({ error: null })
})

describe("public half snapshot schema integration (mock transport)", () => {
  it.each([21097, 21097.5])("reads %s through all public readers and produces comparison facts", async distance => {
    runtime.payload = snapshot(distance)
    const own = await loadOwnOracleComparisonSnapshot(owner)
    const publicSnapshot = await loadPublicOracleComparisonSnapshot(owner)
    const profile = await loadPublicProfile("runner")
    expect(own).toEqual(snapshot(distance))
    expect(publicSnapshot).toEqual(own)
    expect(profile?.oracleSnapshot).toEqual(own)
    expect(deriveFriendRunningOracle(oracleComparisonSnapshotSchema.parse(snapshot(21097.5)), profile!.oracleSnapshot!).facts.join(" "))
      .toContain("21097.5m 기록 차이는 0%")
  })
  it("sends canonical half through save validation without adding consent", async () => {
    const result = await saveOwnOracleComparisonSnapshot(owner, oracleComparisonSnapshotSchema.parse(snapshot(21097.5)))
    expect(result.ok).toBe(true)
    expect(runtime.writes).toHaveBeenCalledWith(expect.objectContaining({ snapshot_payload: snapshot(21097.5) }), { onConflict: "user_id" })
    runtime.writes.mockClear()
    const noConsent = { ...oracleComparisonSnapshotSchema.parse(snapshot(21097.5)), sharedFields: [] }
    expect((await saveOwnOracleComparisonSnapshot(owner, noConsent)).ok).toBe(false)
    expect(runtime.writes).not.toHaveBeenCalled()
  })
  it("does not expose disabled or consent-mismatched snapshots", async () => {
    for (const enabled of [false, true]) {
      runtime.enabled = enabled
      runtime.payload = enabled ? { ...snapshot(21097.5), sharedFields: [] } : snapshot(21097.5)
      expect(await loadOwnOracleComparisonSnapshot(owner)).toBeNull()
      expect(await loadPublicOracleComparisonSnapshot(owner)).toBeNull()
      expect((await loadPublicProfile("runner"))?.oracleSnapshot).toBeNull()
    }
  })
})
