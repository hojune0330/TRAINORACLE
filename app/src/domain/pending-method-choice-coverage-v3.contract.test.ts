import { expect, it } from "vitest"
import { auditAllPendingMainChoices, auditPendingMethodChoices } from "../../../reports/research/method-choice-coverage-v3"
import { METHOD_ADOPTION_PROTOCOLS } from "../../../reports/research/method-adoption-protocols.mjs"

it("does not close introduction coverage when the second choice only repeats the first", () => {
  const first = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-INTRO-LT-C")!
  const second = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-INTRO-LT-S")!
  const original = structuredClone(second)
  try {
    Object.assign(second, structuredClone(first), { id: original.id, method: original.method })
    const result = auditPendingMethodChoices({ eventDistanceM: 5000, experience: "NEW_TO_RUNNING",
      population: "YOUTH", actor: "SELF", family: "LT" })
    expect(result.coverage).toBe("MISSING_DISTINCT_MAIN_OPTIONS")
  } finally { Object.assign(second, original) }
})

it("audits every event, experience, population and actor without granting eligibility", () => {
  const rows = auditAllPendingMainChoices()
  expect(rows).toHaveLength(420)
  expect(new Set(rows.map(r => JSON.stringify(r.context))).size).toBe(420)
  expect(rows.every(r => r.executionAuthority === "NONE" && r.scientificAdoption === "NOT_ESTABLISHED")).toBe(true)
  const gaps = rows.filter(r => r.coverage === "MISSING_DISTINCT_MAIN_OPTIONS")
  expect(gaps.filter(r => r.context.experience === "NEW_TO_RUNNING")).toHaveLength(0)
  expect(gaps.filter(r => r.context.experience === "DEVELOPING" && r.context.family === "ATP-PC")).toHaveLength(0)
  expect(gaps.filter(r => r.context.experience === "DEVELOPING" && r.context.family === "MIX")).toHaveLength(0)
  expect(gaps.filter(r => r.context.experience === "EXPERIENCED" && r.context.family === "MIX")).toHaveLength(0)
  expect(gaps).toHaveLength(0)
  const introductory = rows.filter(r => r.context.experience === "NEW_TO_RUNNING")
  expect(introductory).toHaveLength(140)
  expect(introductory.every(r => r.methodIds.length === 2 && r.methodIds.every(id => id.startsWith("P-INTRO-")))).toBe(true)
})
it("reports sparse ATP and MIX scopes rather than counting repeat variants as methods", () => {
  const context = { eventDistanceM: 42195, experience: "DEVELOPING", population: "ADULT", actor: "SELF", family: "ATP-PC" }
  expect(auditPendingMethodChoices(context)).toMatchObject({ methodIds: ["P-ATP-A", "P-ATP-T"], coverage: "STRUCTURAL_OPTIONS_PRESENT" })
  expect(auditPendingMethodChoices({ ...context, experience: "EXPERIENCED" })).toMatchObject({ coverage: "STRUCTURAL_OPTIONS_PRESENT" })
  expect(auditPendingMethodChoices({ ...context, family: "MIX", experience: "EXPERIENCED" })).toMatchObject({ methodIds: ["P-RHYTHM-400", "P-RHYTHM-T", "P-RHYTHM-TS"], coverage: "STRUCTURAL_OPTIONS_PRESENT" })
  expect(auditPendingMethodChoices({ ...context, family: "OFF" }).coverage).toBe("NOT_A_MAIN_TWO_CHOICE_REQUIREMENT")
})
