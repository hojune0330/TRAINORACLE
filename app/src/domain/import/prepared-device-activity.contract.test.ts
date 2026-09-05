import { describe, expect, it } from "vitest"
import { prepareDeviceActivity } from "./prepared-device-activity"

const sample = {
  provider: "COROS", sourceId: "synthetic-am", sourceVersion: null, sport: "RUNNING",
  startedAt: "2026-09-04T23:59:30+09:00", timeZone: "Asia/Seoul",
  distanceMeters: 400, durationSeconds: 79.8, durationMeaning: "TIMER",
  laps: [{ distanceMeters: 100, durationSeconds: 24, durationMeaning: "TIMER" }],
}
describe("offline device activity preparation", () => {
  it("preserves fractions and explicit time semantics without enabling analysis", () => {
    expect(prepareDeviceActivity(sample)).toMatchObject({ durationSeconds: 79.8, distanceMeters: 400, analysisEligible: false, laps: sample.laps, startedAt: sample.startedAt })
  })
  it("drops unrelated sensitive fields at both activity and lap boundaries", () => {
    const result = prepareDeviceActivity({ ...sample, memo: "PRIVATE_CANARY", token: "TOKEN_CANARY", gps: [37, 127], laps: [{ ...sample.laps[0], memo: "LAP_CANARY" }] })
    expect(result).not.toBeNull()
    expect(JSON.stringify(result)).not.toMatch(/CANARY|memo|token|gps/)
  })
  it.each([NaN, Infinity, -1])("rejects invalid duration %s", value => {
    expect(prepareDeviceActivity({ ...sample, durationSeconds: value })).toBeNull()
  })
  it("retains missing values and does not derive pace, RPE or a timezone", () => {
    expect(prepareDeviceActivity({ ...sample, distanceMeters: null, durationSeconds: null })).toMatchObject({ distanceMeters: null, durationSeconds: null })
    expect(prepareDeviceActivity({ ...sample, timeZone: "invalid" })).toBeNull()
    expect(prepareDeviceActivity({ ...sample, startedAt: "2026-09-04T12:00:00" })).toBeNull()
  })
  it("does not merge two daily sessions or assign a plan identity", () => {
    const am = prepareDeviceActivity(sample)
    const pm = prepareDeviceActivity({ ...sample, sourceId: "synthetic-pm", startedAt: "2026-09-04T18:00:00+09:00" })
    expect(am?.sourceId).not.toBe(pm?.sourceId)
    expect(am).not.toHaveProperty("plannedSessionId")
  })
})
