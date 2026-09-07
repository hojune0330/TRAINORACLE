import { expect, it } from "vitest"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, expandProposal } from "../../../reports/research/method-adoption-protocols.mjs"
import { representPendingMethodV3 } from "../../../reports/research/method-proposal-sequence-v3"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"

it("represents every existing pending protocol and variant without activation or invented targets", () => {
  for (const proposal of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const result = representPendingMethodV3(proposal)
    expect(result.executionAuthority).toBe("NONE")
    if (proposal.family === "OFF") expect(result.kind).toBe("no_exercise")
    else expect(result).toMatchObject({ kind: "represented", supportIncluded: false, targetStatus: "NOT_PRESCRIBED" })
  }
})
it("preserves independently expanded work and recovery amounts for every proposal", () => {
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const result = representPendingMethodV3(p)
    if (result.kind !== "represented") continue
    const parts = expandProposal(p)
    const total = deriveSequenceV3Totals(result.sequence).main
    const amount = (role: string, unit: string) => {
      const selected = parts.filter(s => s.role === role)
      return selected.some(s => s.unit !== unit) ? null : selected.reduce((sum, s) => sum + s.value, 0)
    }
    expect(total.workDistanceM, p.id).toBe(amount("WORK", "METERS"))
    expect(total.workSeconds, p.id).toBe(amount("WORK", "SECONDS"))
    expect(total.buildupDistanceM, p.id).toBe(amount("BUILDUP", "METERS"))
    expect(total.buildupSeconds, p.id).toBe(amount("BUILDUP", "SECONDS"))
    const rest = parts.filter(s => s.boundary !== "WORK")
    expect(total.recoverySteps, p.id).toBe(rest.length)
    expect(total.knownRecoveryDistanceM, p.id).toBe(rest.filter(s => s.unit === "METERS").reduce((n, s) => n + s.value, 0))
    expect(total.knownRecoverySeconds, p.id).toBe(rest.filter(s => s.unit === "SECONDS").reduce((n, s) => n + s.value, 0))
  }
})
it("preserves final roll-on before set recovery and separates buildup from flying work", () => {
  const totals = (id: string) => {
    const result = representPendingMethodV3(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)!)
    if (result.kind !== "represented") throw Error("No sequence")
    return deriveSequenceV3Totals(result.sequence).main
  }
  expect(totals("P-RHYTHM-300")).toMatchObject({ workDistanceM: 1800, recoveryDistanceM: null,
    recoverySeconds: null, knownRecoveryDistanceM: 600, knownRecoverySeconds: 240, recoverySteps: 8 })
  expect(totals("P-ATP-F")).toMatchObject({ workDistanceM: 40, buildupDistanceM: 80 })
  expect(totals("P-GLY-S")).toMatchObject({ workDistanceM: 1200, recoverySeconds: 780 })
})
it("rejects missing recovery and attempted activation before representation", () => {
  const p = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-GLY-S")!
  expect(() => representPendingMethodV3({ ...p, setRest: null })).toThrow()
  expect(() => representPendingMethodV3({ ...p, between: null })).toThrow()
  expect(() => representPendingMethodV3({ ...p, executionAuthority: "ACTIVE" })).toThrow()
  expect(() => representPendingMethodV3({ ...p, reps: 1.5 })).toThrow()
})
