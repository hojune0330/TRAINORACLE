import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildExpandedWorkoutCatalog, expandedStructureKey, validateExpandedWorkoutCard, reviewExpandedPool, EXPANDED_SOURCES,
} from "../../../reports/research/expanded-workout-catalog-v3"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

const cards = buildExpandedWorkoutCatalog()
const byId = (id: string) => {
  const card = cards.find(c => c.id === id)
  if (!card) throw Error(`MISSING_FIXTURE: ${id}`)
  return card
}
const mutable = (id = "X-LT-07") => JSON.parse(JSON.stringify(byId(id)))
const refingerprint = (card: ReturnType<typeof byId>) => {
  const { fingerprint: _fingerprint, ...content } = card
  return { ...card, fingerprint: canonicalJsonFingerprint("trainoracle.expanded-catalog.v1", content) }
}
const context = { family: "LT" as const, eventDistanceM: 5000, experience: "EXPERIENCED" as const, terrain: "FLAT" as const,
  availableModalities: ["RUN", "WALK"] as const, safety: "NO_KNOWN_RISK" as const, hasAccelerationSpace: true, hardTimeLimitSeconds: 3600 }
const leaves = (nodes: readonly SequenceNodeV3[]): SequenceNodeV3[] => nodes.flatMap(n => n.kind === "segment" ? [n] : leaves(n.children))

describe("expanded workout catalog, not runtime adoption", () => {
  it("has 80 configurations across 50 purpose/method groups, not 80 independent methods", () => {
    expect(cards).toHaveLength(80)
    expect(new Set(cards.map(c => c.id)).size).toBe(80)
    expect(new Set(cards.map(expandedStructureKey)).size).toBe(80)
    expect(new Set(cards.map(c => `${c.family}:${c.methodGroup}`)).size).toBe(50)
    expect(Object.fromEntries(["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC"].map(f => [f, cards.filter(c => c.family === f).length])))
      .toEqual({ BASE: 12, LT: 14, VO2: 14, "ATP-PC": 11, GLY: 9, MIX: 12, REC: 8 })
  })

  it.each(cards.map(c => [c.id, c] as const))("%s parses, has context for every part, and has honest authority", (_id, card) => {
    expect(parsePrescriptionSequenceV3(card.sequence).kind).toBe("parsed")
    expect(validateExpandedWorkoutCard(card)).toEqual([])
    expect(card.totals).toEqual(deriveSequenceV3Totals(card.sequence).main)
    expect(card.runtimeReady).toBe(false)
    expect(card.executionAuthority).toBe("NONE")
    expect(card.automaticProgressionAllowed).toBe(false)
    expect(card.pairedAlternativeId).toBeNull()
    expect(card.proposedScope.population).toEqual(["YOUTH", "ADULT"])
    expect(card.proposedScope.actor).toContain("SELF")
    expect(card.proposedScope.eventDistancesM).not.toContain(400)
    expect(card.explanation.personalEvidence).toEqual([])
    expect(card.explanation.sourceIds.every(id => !!EXPANDED_SOURCES[id].limitation)).toBe(true)
    expect(card.sequence.warmup).toEqual([])
    expect(card.sequence.cooldown).toEqual([])
    expect(card.wholeSessionComplete).toBe(false)
    expect(card.requiredReview).toContain("WARMUP_COOLDOWN_BINDING")
  })

  it("keeps 45min, 8km, 60min and 12km in one method family", () => {
    expect(new Set([1, 2, 3, 4].map(i => byId(`X-BASE-0${i}`).methodGroup)).size).toBe(1)
    expect(byId("X-BASE-03").requiredReview).toContain("RECENT_LONG_RUN_BASELINE")
    expect(byId("X-BASE-02").totals.totalSeconds).toBeNull()
  })
  it("counts two sets of three 4min LT blocks with four r45 and one R180", () => {
    expect(byId("X-LT-07").totals).toMatchObject({ workSegments: 6, workSeconds: 1440, recoverySteps: 5, recoverySeconds: 360, totalSeconds: 1800 })
  })
  it("preserves all four final 200m roll-ons without inventing their time", () => {
    expect(byId("X-LT-08").totals).toMatchObject({ workDistanceM: 4000, recoveryDistanceM: 800, recoverySteps: 4, totalSeconds: null })
  })
  it("keeps the last easy jog in the 6min+2min pattern", () => {
    expect(byId("X-LT-09").totals).toMatchObject({ workSeconds: 1080, recoverySeconds: 360, totalSeconds: 1440 })
  })
  it("30/30 has 16 work segments, 14 short recoveries and one set recovery", () => {
    expect(byId("X-VO2-07").totals).toMatchObject({ workSegments: 16, workSeconds: 480, recoverySteps: 15, recoverySeconds: 600, totalSeconds: 1080 })
    expect(byId("X-VO2-07").explanation.evidenceNature).toBe("PRODUCT_COACHING_DRAFT_NOT_PUBLISHED_DOSE")
  })
  it("broken intervals count internal and external recovery separately", () => {
    expect(byId("X-VO2-12").totals).toMatchObject({ workSeconds: 720, recoverySeconds: 780, totalSeconds: 1500, recoverySteps: 11 })
  })
  it("flying sprint preserves approach, high-output and deceleration roles", () => {
    expect(byId("X-ATP-07").totals).toMatchObject({ buildupDistanceM: 40, workDistanceM: 80, preparationDistanceM: 40, recoverySeconds: 720 })
    expect(leaves(byId("X-ATP-07").sequence.main).map(n => n.kind === "segment" && n.target.kind)).toEqual(["EFFORT_GUIDANCE", "EFFORT_GUIDANCE", "EFFORT_GUIDANCE"])
  })
  it("split GLY does not describe the 45s internal break as full recovery", () => {
    expect(byId("X-GLY-04").totals).toMatchObject({ workDistanceM: 900, recoverySeconds: 735, recoverySteps: 5 })
    expect(byId("X-GLY-04").explanation.configurationReason).toContain("불완전")
  })
  it("MIX preserves purpose per block and does not misclassify steady as easy BASE", () => {
    expect(byId("X-MIX-09").segmentContexts.map(c => c.intent)).toEqual(["LT", "VO2", "GLY"])
    expect(byId("X-MIX-08").segmentContexts.map(c => c.intent)).toEqual(["VO2", "STEADY"])
    expect(byId("X-MIX-07").segmentContexts.map(c => c.intent)).toEqual(["LT", "TECHNIQUE"])
  })
  it("run/walk records all 24 minutes and does not count only jogging", () => {
    expect(byId("X-REC-02").totals.totalSeconds).toBe(1440)
    expect(byId("X-REC-02").segmentContexts.map(c => c.modality)).toEqual(["RUN", "WALK"])
  })
  it("cross-training remains separate, without invented running kilometres", () => {
    expect(byId("X-REC-07").segmentContexts.map(c => c.modality)).toEqual(["BIKE", "WALK"])
    expect(byId("X-REC-07").totals.totalDistanceM).toBeNull()
    expect(byId("X-REC-05").requiredReview).toContain("WATER_SAFETY_AND_EQUIPMENT")
  })
  it("six hill efforts have six returns, plus exactly one 3min set break", () => {
    expect(byId("X-HILL-03").totals).toMatchObject({ workSeconds: 36, recoverySteps: 7, recoverySeconds: null, knownRecoverySeconds: 180, totalSeconds: null })
    expect(byId("X-HILL-03").requiredReview).toContain("HILL_SURFACE_GRADE_RETURN")
  })
  it("continuous hill tempo includes the final walking return", () => {
    expect(byId("X-HILL-08").totals).toMatchObject({ workSeconds: 600, recoverySteps: 1, totalSeconds: null })
  })
  it("does not use a renamed card to create a new structure", () => {
    const renamed = { ...byId("X-LT-01"), id: "RENAMED", name: "다른 이름" }
    expect(expandedStructureKey(renamed)).toBe(expandedStructureKey(byId("X-LT-01")))
  })

  it.each([
    ["repetition", (c: ReturnType<typeof mutable>) => { c.sequence.main[0].repeatCount = 3 }],
    ["recovery", (c: ReturnType<typeof mutable>) => { c.sequence.main[0].recoveryBetweenRepeats[0].seconds = 120 }],
    ["missing segment metadata", (c: ReturnType<typeof mutable>) => { c.segmentContexts = [] }],
    ["missing recovery explanation", (c: ReturnType<typeof mutable>) => { c.recoveryContexts = [] }],
    ["personal evidence", (c: ReturnType<typeof mutable>) => { c.explanation.personalEvidence = ["raw private text"] }],
    ["fake activation", (c: ReturnType<typeof mutable>) => { c.runtimeReady = true }],
    ["pairing", (c: ReturnType<typeof mutable>) => { c.pairedAlternativeId = "X-LT-02" }],
    ["unknown source", (c: ReturnType<typeof mutable>) => { c.explanation.sourceIds = ["NOT_A_SOURCE"] }],
    ["wrong purpose", (c: ReturnType<typeof mutable>) => { c.family = "GLY" }],
    ["wrong segment purpose", (c: ReturnType<typeof mutable>) => { c.segmentContexts[0].intent = "GLY" }],
    ["removed review boundary", (c: ReturnType<typeof mutable>) => { c.requiredReview = [] }],
  ] as const)("rejects injected %s even after a new fingerprint", (_name, change) => {
    const card = mutable()
    change(card)
    expect(validateExpandedWorkoutCard(refingerprint(card)).length).toBeGreaterThan(0)
  })
  it("rejects a changed rationale with stale fingerprint", () => {
    const card = mutable()
    card.explanation.configurationReason = "새 이유"
    expect(validateExpandedWorkoutCard(card)).toContain("CONTENT_CHANGED")
  })

  it("reviews same-purpose pools, not preset pairs, and never grants runtime authority", () => {
    const result = reviewExpandedPool(context)
    expect(result.kind).toBe("review")
    expect(result.rows).toHaveLength(14)
    expect(result.rows.filter(r => !r.excluded.length)).toHaveLength(12)
    expect(result.rows.every(r => !r.runtimeReady && r.checks.includes("OWNER_FINAL_ADOPTION"))).toBe(true)
  })
  it("does not copy flat protocols to hills", () => {
    const result = reviewExpandedPool({ ...context, terrain: "UPHILL" })
    expect(result.rows.filter(r => !r.excluded.length).map(r => r.id)).toEqual(["X-HILL-07", "X-HILL-08"])
  })
  it("unknown terrain remains unknown rather than matched", () => {
    expect(reviewExpandedPool({ ...context, terrain: "UNKNOWN" }).rows.every(r => r.checks.includes("TERRAIN_UNKNOWN"))).toBe(true)
  })
  it("only accepts a hill/flat combination when both connected terrains are supplied", () => {
    const single = reviewExpandedPool({ ...context, family: "MIX", terrain: "UPHILL" })
    expect(single.rows.find(r => r.id === "X-HILL-11")?.excluded).toContain("TERRAIN_OR_CONNECTED_ROUTE_REQUIRED")
    const connected = reviewExpandedPool({ ...context, family: "MIX", terrain: "UPHILL", connectedTerrains: ["FLAT"] })
    expect(connected.rows.find(r => r.id === "X-HILL-11")?.excluded).toEqual([])
    expect(connected.rows.find(r => r.id === "X-HILL-11")?.checks).toContain("CONNECTED_HILL_FLAT_ROUTE")
  })
  it("supports bike plus walking without treating either as running", () => {
    const result = reviewExpandedPool({ ...context, family: "REC", terrain: "INDOOR", connectedTerrains: ["FLAT"], availableModalities: ["BIKE", "WALK"] })
    expect(result.rows.find(r => r.id === "X-REC-07")?.excluded).toEqual([])
    expect(result.rows.find(r => r.id === "X-REC-01")?.excluded).toContain("MODALITY_UNAVAILABLE")
  })
  it("blocks known safety concerns before selection", () => {
    expect(reviewExpandedPool({ ...context, safety: "REVIEW_REQUIRED" }).rows.every(r => r.excluded.includes("SAFETY_REVIEW_REQUIRED"))).toBe(true)
  })
  it("does not declare missing safety as clear", () => {
    expect(reviewExpandedPool({ ...context, safety: "UNKNOWN" }).rows.every(r => r.checks.includes("SAFETY_UNKNOWN"))).toBe(true)
  })
  it("does not select high-output drills without acceleration space", () => {
    expect(reviewExpandedPool({ ...context, family: "ATP-PC", hasAccelerationSpace: false }).rows.every(r => r.excluded.includes("ACCELERATION_SPACE_UNAVAILABLE"))).toBe(true)
  })
  it("does not supply experienced doses to a new runner", () => {
    expect(reviewExpandedPool({ ...context, experience: "NEW_TO_RUNNING" }).rows.every(r => r.excluded.includes("EXPERIENCE_OUTSIDE_DRAFT"))).toBe(true)
  })
  it("does not mistake a main-only time for a complete session fitting the available time", () => {
    const result = reviewExpandedPool({ ...context, hardTimeLimitSeconds: 1200 })
    expect(result.rows.find(r => r.id === "X-LT-07")?.excluded).toContain("MAIN_ALREADY_EXCEEDS_LIMIT")
    expect(result.rows.every(r => r.checks.includes("WHOLE_SESSION_TIME_NOT_BOUND"))).toBe(true)
  })
  it.each([400, -1, Number.NaN])("rejects unsupported event %s", eventDistanceM => {
    expect(reviewExpandedPool({ ...context, eventDistanceM }).kind).toBe("invalid_context")
  })
  it("preserves the original 37 protocol source without catalog imports", () => {
    const original = readFileSync(resolve(process.cwd(), "../reports/research/method-adoption-protocols.mjs"), "utf8")
    expect(original).not.toContain("expanded-workout-catalog")
  })
})
