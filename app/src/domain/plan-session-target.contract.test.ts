import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { listDetailedSessionTargets } from "./plan-session-target"

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-05T03:00:00Z")); localStorage.clear() })
afterEach(() => vi.useRealTimers())

function baseline() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected fixture generation")
  return result.generated
}

describe("shared MAIN target availability", () => {
  it("offers every shared MAIN with its actual AM/PM slot", () => {
    const generated = baseline()
    const targets = listDetailedSessionTargets(generated)
    expect(targets.length).toBeGreaterThan(1)
    expect(targets).toEqual(generated.candidates[0].sessions.filter(s => s.role === "QUALITY").map(s => ({ day: s.day, slot: s.slot })))
    expect(targets.some(s => s.slot === "PM")).toBe(true)
  })
  it("excludes missing, duplicate or mismatched slots rather than borrowing another date", () => {
    const generated = baseline()
    const target = listDetailedSessionTargets(generated)[0]!
    const session = generated.candidates[1].sessions.find(s => s.day === target.day && s.slot === target.slot)!
    const scenarios = [
      generated.candidates[1].sessions.filter(s => s !== session),
      [...generated.candidates[1].sessions, session],
      generated.candidates[1].sessions.map(s => s === session && s.role === "QUALITY" ? { ...s, plannedEnergyIntent: "GLY_INTENT" as const } : s),
    ]
    for (const sessions of scenarios) {
      const result = listDetailedSessionTargets({ ...generated, candidates: [generated.candidates[0], { ...generated.candidates[1], sessions }] })
      expect(result).not.toContainEqual(target)
      expect(result.length).toBeGreaterThan(0)
    }
  })
})
