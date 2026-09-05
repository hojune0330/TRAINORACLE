import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { mainDraftStillMatches, snapshotPlanMainDraft } from "./plan-main-draft"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T03:00:00Z")) })
afterEach(() => vi.useRealTimers())

function fixture() {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Fixture generation failed")
  return result
}

describe("MAIN draft scope and immutable commit snapshot", () => {
  it("identifies each real shared MAIN independently and freezes the detached snapshot", () => {
    const { generated, intake } = fixture()
    const snapshot = snapshotPlanMainDraft(generated, intake, "2026-09-10")!
    expect(snapshot.slots.length).toBeGreaterThan(1)
    expect(new Set(snapshot.slots.map(slot => slot.mainSlotId)).size).toBe(snapshot.slots.length)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.slots)).toBe(true)
    expect(snapshot.slots.every(Object.isFrozen)).toBe(true)
    expect(mainDraftStillMatches(snapshot, generated, intake, "2026-09-10")).toBe(true)
  })

  it("keeps slot identity but invalidates content when a duration or method changes", () => {
    const { generated, intake } = fixture()
    const snapshot = snapshotPlanMainDraft(generated, intake, "2026-09-10")!
    const modified = structuredClone(generated)
    const main = modified.candidates[0].sessions.find(session => session.role === "QUALITY")!
    if (main.prescription.kind !== "RPE_TIME_RANGE") throw new Error("Expected time range")
    Object.assign(main.prescription.durationMinutes, { maximum: main.prescription.durationMinutes.maximum + 1 })
    const changed = snapshotPlanMainDraft(modified, intake, "2026-09-10")!
    expect(changed.slots).toEqual(snapshot.slots)
    expect(changed.contentFingerprint).not.toBe(snapshot.contentFingerprint)
    expect(mainDraftStillMatches(snapshot, modified, intake, "2026-09-10")).toBe(false)
  })

  it("does not carry a slot into another date, event, purpose, experience or calendar layout", () => {
    const { generated, intake } = fixture()
    const snapshot = snapshotPlanMainDraft(generated, intake, "2026-09-10")!
    for (const change of [
      { eventDistanceM: 3000 as const }, { trainingFocus: "GLY_INTENT" as const },
      { experienceBand: "DEVELOPING" as const },
    ]) {
      expect(snapshotPlanMainDraft(generated, { ...intake, ...change }, "2026-09-10")?.scopeFingerprint)
        .not.toBe(snapshot.scopeFingerprint)
    }
    expect(mainDraftStillMatches(snapshot, generated, intake, "2026-09-11")).toBe(false)
    const layout = structuredClone(generated)
    const main = layout.candidates[0].sessions.find(session => session.role === "QUALITY")!
    Object.assign(main, { slot: main.slot === "AM" ? "PM" : "AM" })
    expect(snapshotPlanMainDraft(layout, intake, "2026-09-10")?.scopeFingerprint).not.toBe(snapshot.scopeFingerprint)
  })

  it("retains original data and refuses invalid date or unserializable input", () => {
    const { generated, intake } = fixture()
    const original = JSON.stringify(generated)
    expect(snapshotPlanMainDraft(generated, intake, "2026-02-30")).toBeNull()
    const invalid = structuredClone(generated)
    Object.assign(invalid.candidates[0], { malformed: Number.NaN })
    expect(snapshotPlanMainDraft(invalid, intake, "2026-09-10")).toBeNull()
    expect(JSON.stringify(generated)).toBe(original)
  })
})
