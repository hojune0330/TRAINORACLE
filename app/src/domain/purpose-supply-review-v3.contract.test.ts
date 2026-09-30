import { describe, expect, it } from "vitest"
import { buildPurposeSupplyCatalog, comparePurposeCards, reviewPurposeSupply,
  type PurposeSupplyContext } from "../../../reports/research/method-purpose-supply-v3"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "../../../reports/research/method-adoption-protocols.mjs"
import { METHOD_SOURCE_ASSESSMENTS, sourceAssessmentFor } from "../../../reports/research/method-source-assessments-v3"
import { PROPOSED_METHOD_SCOPES } from "../../../reports/research/method-adoption-applicability.mjs"

const base: PurposeSupplyContext = {
  family: "LT", eventDistanceM: 5000, experience: "EXPERIENCED", population: "ADULT", actor: "SELF", role: "MAIN",
  safety: "NO_KNOWN_RISK", phase: "BUILD", terrain: "FLAT", measuredDistance: true, repetitionTimer: true,
  accelerationSpace: true, hardTimeLimitSeconds: 3600, support: "EXISTING", otherQualitySameDay: false, wantsPersonalPace: false,
}
const review = (patch: Partial<PurposeSupplyContext> = {}) => reviewPurposeSupply({ ...base, ...patch })
const row = (id: string, patch: Partial<PurposeSupplyContext> = {}) => review(patch).rows.find(r => r.card.id === id)!
const catalog = buildPurposeSupplyCatalog()
const card = (id: string) => catalog.find(c => c.id === id)!

describe("purpose supply: review is not runtime activation", () => {
  it("recounts exact existing configurations without changing the source or granting authority", () => {
    const original = JSON.stringify([METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS])
    const cards = buildPurposeSupplyCatalog()
    expect(cards).toHaveLength(37)
    expect(new Set(cards.map(c => c.id)).size).toBe(37)
    expect(Object.fromEntries(["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC", "OFF"]
      .map(f => [f, cards.filter(c => c.family === f).length])))
      .toEqual({ BASE: 4, LT: 6, VO2: 7, "ATP-PC": 7, GLY: 4, MIX: 7, REC: 1, OFF: 1 })
    for (const c of cards) {
      expect(c.executionAuthority).toBe("NONE")
      expect(c.explanation.personalEvidence).toEqual([])
      expect(c.explanation.sources.exactPopulationDoseEstablished).toBe(false)
      expect(c.explanation.sources.links.length).toBeGreaterThan(0)
      for (const key of ["purpose", "energySupply", "work", "recovery", "tradeoff", "expected", "observation", "cycleRole"] as const) {
        expect(c.explanation[key].length).toBeGreaterThan(10)
      }
      expect(c.explanation.limitations.length).toBeGreaterThan(0)
      expect(c.sequenceScope).toBe("MAIN_ONLY")
      expect(c.sequence?.warmup ?? []).toEqual([])
      expect(c.sequence?.cooldown ?? []).toEqual([])
    }
    cards[0]!.exactStructure.work[0]!.value = 1
    expect(JSON.stringify([METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS])).toBe(original)
    expect(buildPurposeSupplyCatalog()).toEqual(catalog)
  })

  it.each([
    ["P-BASE-C", "P-BASE-C-1200", "dose_variant"],
    ["P-LT-C", "P-INTRO-LT-C", "dose_variant"],
    ["P-LT-B", "P-LT-B-480", "dose_variant"],
    ["P-VO2-2", "P-VO2-2-4", "dose_variant"],
    ["P-ATP-A", "P-ATP-A-5", "dose_variant"],
    ["P-LT-C", "P-LT-B", "different_method"],
    ["P-VO2-2", "P-VO2-3", "different_method"],
    ["P-GLY-D", "P-GLY-S", "different_method"],
    ["P-RHYTHM-400", "P-RHYTHM-400-2X6", "different_method"],
    ["P-LT-C", "P-BASE-C", "different_purpose"],
    ["P-OFF", "P-OFF", "not_exercise_comparison"],
  ])("distinguishes %s vs %s as %s, not by name or repetitions", (a, b, expected) => {
    expect(comparePurposeCards(card(a), card(b)).kind).toBe(expected)
  })

  it("does not claim equal effects or loads for distinct configurations", () => {
    expect(comparePurposeCards(card("P-GLY-D"), card("P-GLY-S")))
      .toMatchObject({ equalBurden: false, equalEffect: false, executionAuthority: "NONE" })
  })

  it("filters by purpose without fixed pairs or role substitution", () => {
    expect(review().rows.every(r => r.card.family === "LT")).toBe(true)
    expect(row("P-LT-C").contextFit).toBe("DECLARED_CONSTRAINTS_MATCH")
    expect(row("P-LT-C").runtimeReady).toBe(false)
    expect(row("P-LT-C", { role: "REC" }).excluded).toContain("ROLE_MISMATCH")
    expect(row("P-LT-C", { role: "REC" }).reasons).not.toContain("PROPOSED_SCOPE_MATCH")
    expect(row("P-ATP-F", { family: "ATP-PC", experience: "DEVELOPING" }).excluded)
      .toContain("EXPERIENCE_OUTSIDE_PROPOSAL")
    expect(row("P-RHYTHM-300", { family: "MIX", eventDistanceM: 42195 }).excluded).toContain("EVENT_OUTSIDE_PROPOSAL")
  })

  it("includes support and recovery in time fit; a 21 minute main block needs 50m20s total", () => {
    expect(row("P-LT-B", { hardTimeLimitSeconds: 3020 }).time)
      .toEqual({ timeFit: "FITS_DECLARED_LIMIT", totalSeconds: 3020, knownSeconds: 3020, supportSeconds: 1760 })
    expect(row("P-LT-B", { hardTimeLimitSeconds: 3019 }).excluded).toContain("WHOLE_SESSION_EXCEEDS_HARD_LIMIT")
    expect(row("P-LT-B", { support: "UNSELECTED" })).toMatchObject({
      wholeSession: null, time: { totalSeconds: null, supportSeconds: null, timeFit: "UNRESOLVED" },
    })
    expect(row("P-LT-B", { support: "INTRO_COMPARISON" }).excluded).toContain("SUPPORT_SCOPE_MISMATCH")
  })

  it("does not silently shorten support for beginners and ties totals to the chosen exact sequence", () => {
    const context = { family: "VO2" as const, experience: "NEW_TO_RUNNING" as const, hardTimeLimitSeconds: 1500 }
    const original = row("P-INTRO-VO2-2", context)
    const alternate = row("P-INTRO-VO2-2", { ...context, support: "INTRO_COMPARISON" })
    expect(original.time).toMatchObject({ totalSeconds: 2300, timeFit: "EXCEEDS_LIMIT", supportSeconds: 1760 })
    expect(alternate.time).toMatchObject({ totalSeconds: 1300, timeFit: "FITS_DECLARED_LIMIT", supportSeconds: 760 })
    expect(alternate.wholeSession?.supportRef?.id).toBe("P-SUPPORT-INTRO-01")
    const allParts = [...alternate.wholeSession!.warmup, ...alternate.wholeSession!.main, ...alternate.wholeSession!.cooldown]
    expect(allParts.every(p => p.unit === "SECONDS")).toBe(true)
    expect(allParts.reduce((sum, p) => sum + p.value, 0)).toBe(alternate.time.totalSeconds)
    expect(alternate.checks).toContain("CONTENT_MODIFICATION_REVIEW")
    expect(alternate.runtimeReady).toBe(false)
  })

  it("does not convert distance to time; known recovery and support can still exceed the limit", () => {
    const distance = row("P-GLY-D", { family: "GLY", hardTimeLimitSeconds: 3000 })
    expect(distance.time).toMatchObject({ totalSeconds: null, knownSeconds: 2360, timeFit: "UNRESOLVED" })
    expect(row("P-GLY-D", { family: "GLY", hardTimeLimitSeconds: 2300 }).time.timeFit).toBe("EXCEEDS_LIMIT")
    expect(card("P-VO2-2").exactStructure.workMeters).toBeNull()
    expect(card("P-OFF").exactStructure.exactMainSeconds).toBeNull()
    expect(row("P-OFF", { family: "OFF", role: "OFF" }).time.timeFit).toBe("NOT_APPLICABLE")
  })

  it("preserves every roll-on and additional set recovery instead of equalizing work distance", () => {
    const straight = row("P-RHYTHM-400", { family: "MIX" }).wholeSession!.main
    const split = row("P-RHYTHM-400-2X6", { family: "MIX" }).wholeSession!.main
    expect(straight.filter(p => p.boundary === "AFTER_EVERY")).toHaveLength(12)
    expect(split.filter(p => p.boundary === "AFTER_EVERY")).toHaveLength(12)
    expect(split.filter(p => p.boundary === "BETWEEN_SETS")).toEqual([
      { role: "EASY_RUN", unit: "SECONDS", value: 180, set: 1, rep: 6, boundary: "BETWEEN_SETS" },
    ])
    expect(split.at(-1)?.boundary).toBe("AFTER_EVERY")
  })

  it("requires usable space and measurements but offers time-based review when a track is absent", () => {
    expect(row("P-ATP-A", { family: "ATP-PC", measuredDistance: false }).excluded).toContain("MEASURED_DISTANCE_UNAVAILABLE")
    expect(row("P-VO2-2", { family: "VO2", measuredDistance: false }).contextFit).toBe("DECLARED_CONSTRAINTS_MATCH")
    expect(row("P-ATP-T", { family: "ATP-PC", accelerationSpace: false }).excluded).toContain("ACCELERATION_SPACE_UNAVAILABLE")
    expect(row("P-VO2-2", { family: "VO2", repetitionTimer: null }).checks).toContain("TIMER_UNCONFIRMED")
    expect(row("P-VO2-2", { family: "VO2", repetitionTimer: false }).excluded).toContain("TIMER_UNAVAILABLE")
  })

  it("does not rename flat sessions as hills or derive a taper/return policy", () => {
    expect(review({ terrain: "HILL" }).rows.every(r => r.excluded.includes("HILL_SPECIFIC_PROTOCOL_REQUIRED"))).toBe(true)
    expect(row("P-LT-C", { terrain: "UNKNOWN" }).checks).toContain("TERRAIN_UNCONFIRMED")
    for (const phase of ["TAPER", "RETURN", "UNKNOWN"] as const) {
      expect(row("P-LT-C", { phase }).checks).toContain(`${phase}_PLACEMENT_REVIEW`)
    }
    for (const otherQualitySameDay of [true, null]) {
      expect(row("P-LT-C", { otherQualitySameDay }).checks).toContain("SAME_DAY_QUALITY_CONTEXT_REVIEW")
    }
  })

  it("keeps youth/self participation distinct from pain and assigned-coach authority", () => {
    expect(row("P-LT-C", { population: "YOUTH", actor: "SELF" }).contextFit).toBe("DECLARED_CONSTRAINTS_MATCH")
    expect(row("P-LT-C", { actor: "COACH_REQUIRED" }).checks).toContain("ASSIGNED_COACH_SELECTION_REQUIRED")
    expect(row("P-LT-C", { safety: "REVIEW_REQUIRED" }).excluded).toContain("SAFETY_REVIEW_REQUIRED")
    expect(row("P-LT-C", { safety: "UNKNOWN" }).checks).toContain("SAFETY_UNKNOWN")
    expect(row("P-LT-C", { wantsPersonalPace: true }).checks).toContain("PERSONAL_PACE_MODEL_NOT_ADOPTED")
    expect(row("P-INTRO-GLY-D", { family: "GLY", experience: "NEW_TO_RUNNING" }).excluded).toContain("HELD_FROM_FIRST_RELEASE")
  })

  it("does not generalize a source example into dose approval or hide prior-only source checks", () => {
    const direct = catalog.filter(c => c.explanation.sources.workRestEvidence === "PUBLISHED_COACHING_WORK_REST_EXAMPLE")
    expect(direct.map(c => c.id)).toEqual(["P-VO2-2", "P-VO2-3", "P-VO2-4"])
    expect(card("P-VO2-2-4").explanation.sources.workRestEvidence).toBe("PRODUCT_COACHING_CONFIGURATION")
    expect(METHOD_SOURCE_ASSESSMENTS.SPRINT_ENERGY!.checked).toBe("PREVIOUS_LOCAL_REVIEW")
    expect(METHOD_SOURCE_ASSESSMENTS.HILL_TRANSFER!.doesNotEstablish).toContain("경사")
    expect(direct.every(c => c.explanation.sources.exactPopulationDoseEstablished === false)).toBe(true)
  })

  it.each(["reps", "work", "recovery", "mode", "afterEvery", "set"] as const)(
    "revokes exact source-example attribution after %s mutation, even if the ID is unchanged", mutation => {
      const original = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-VO2-2")!
      const changed = structuredClone(original)
      if (mutation === "reps") changed.reps = 5
      if (mutation === "work") changed.work[0]!.value = 121
      if (mutation === "recovery") changed.between!.value = 61
      if (mutation === "mode") changed.between!.role = "WALK"
      if (mutation === "afterEvery") changed.afterEvery = changed.between
      if (mutation === "set") changed.sets = 2
      expect(sourceAssessmentFor(original).workRestEvidence).toBe("PUBLISHED_COACHING_WORK_REST_EXAMPLE")
      expect(sourceAssessmentFor(changed).workRestEvidence).toBe("PRODUCT_COACHING_CONFIGURATION")
    },
  )

  it("changes the content fingerprint with the actual prescription and refuses ambiguous scope", () => {
    const p = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-VO2-2")!
    const original = structuredClone(p)
    try {
      p.reps = 5
      const revised = buildPurposeSupplyCatalog().find(c => c.id === p.id)!
      expect(revised.contentFingerprint).not.toBe(card(p.id).contentFingerprint)
      expect(revised.notation).toContain("5 × 2min")
      expect(revised.explanation.sources.workRestEvidence).toBe("PRODUCT_COACHING_CONFIGURATION")
    } finally { Object.assign(p, original) }
    PROPOSED_METHOD_SCOPES.push(structuredClone(PROPOSED_METHOD_SCOPES[0]!))
    try { expect(() => buildPurposeSupplyCatalog()).toThrow("EXACT_PROPOSED_SCOPE_REQUIRED") }
    finally { PROPOSED_METHOD_SCOPES.pop() }
  })

  it.each([
    { eventDistanceM: 400 }, { hardTimeLimitSeconds: 0 }, { hardTimeLimitSeconds: -1 },
    { hardTimeLimitSeconds: NaN }, { hardTimeLimitSeconds: Infinity }, { hardTimeLimitSeconds: 1.2 },
    { experience: "UNKNOWN" }, { measuredDistance: undefined }, { otherQualitySameDay: "false" },
  ])("rejects invalid input %j instead of widening scope", patch => {
    expect(review(patch as Partial<PurposeSupplyContext>)).toMatchObject({ kind: "invalid_context", rows: [], executionAuthority: "NONE" })
  })

  it("exports selected structured fields only, never incidental private context", () => {
    const extra = { ...base, memo: "PRIVATE_MEMO_SENTINEL", symptomClause: "PRIVATE_SYMPTOM_SENTINEL", athleteName: "PRIVATE_NAME_SENTINEL" }
    const output = JSON.stringify(reviewPurposeSupply(extra))
    expect(output).not.toMatch(/PRIVATE_(MEMO|SYMPTOM|NAME)_SENTINEL/)
  })

  it("covers 420 synthetic scope combinations with no execution authority", () => {
    let count = 0
    for (const eventDistanceM of [800, 1500, 3000, 5000, 10000, 21097, 42195]) {
      for (const experience of ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const) {
        for (const population of ["YOUTH", "ADULT"] as const) {
          for (const actor of ["SELF", "COACH_REQUIRED"] as const) {
            for (const family of ["LT", "VO2", "ATP-PC", "GLY", "MIX"] as const) {
              const result = review({ eventDistanceM, experience, population, actor, family })
              count++
              expect(result.kind).toBe("review")
              expect(result.rows.length).toBeGreaterThan(0)
              expect(result.rows.every(r => !r.runtimeReady && r.executionAuthority === "NONE")).toBe(true)
              expect(result.rows.filter(r => r.excluded.length).every(r => r.contextFit === "EXCLUDED")).toBe(true)
              expect(result.rows.filter(r => r.contextFit === "DECLARED_CONSTRAINTS_MATCH")
                .every(r => r.excluded.length === 0 && r.checks.length === 0 && r.pending.length > 0)).toBe(true)
            }
          }
        }
      }
    }
    expect(count).toBe(420)
  }, 60_000)
})
