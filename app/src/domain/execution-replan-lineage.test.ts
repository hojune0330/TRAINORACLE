import { describe, expect, it } from "vitest"
import { prepareExecutionReplan } from "./execution-replan"
import { replacedReplanFixture } from "./execution-replan-lineage.test-fixture"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { prepareCatalogReplacement } from "./catalog-replacement"
import { resolveExecutionReplanSource } from "./execution-replan-source"

describe("same-cycle execution review after unrelated future changes", () => {
  it("uses the original journal after two replacements without changing its link or original plans", () => {
    const f = replacedReplanFixture(), before = JSON.stringify(f)
    const result = prepareExecutionReplan(f)
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("ready")
    expect(result.proposals.length).toBeGreaterThan(0)
    for (const proposal of result.proposals) {
      expect(proposal.before).toEqual(f.state)
      expect(proposal.after.executionReplan!.sourceJournalId).toBe(f.entryId)
      expect(proposal.after.activePlan.sessions[0]).toEqual(f.archivedPlans[0]!.activePlan.sessions[0])
    }
    expect(JSON.stringify(f)).toBe(before)
  })

  it("continues through a further execution-replan receipt using the same original journal", () => {
    const f = replacedReplanFixture(), result = prepareExecutionReplan(f)
    if (result.kind !== "ready") throw Error("ready")
    const after = result.proposals.find(p => p.action === "REDUCE")!.after
    expect(prepareExecutionReplan({ ...f, state: after, archivedPlans: [...f.archivedPlans, f.state] }).kind).toBe("ready")
  })

  it.each(["missing-middle", "missing-original", "forged-base", "different-cycle", "changed-original"])("rejects %s rather than guessing from dates", reason => {
    const f = replacedReplanFixture()
    if (reason === "missing-middle") f.archivedPlans.pop()
    if (reason === "missing-original") f.archivedPlans.shift()
    if (reason === "forged-base") f.state.catalogReplacement!.baseCandidateId += "-forged"
    if (reason === "different-cycle") f.state.generatedAt = "2026-09-28T01:00:00.000Z"
    if (reason === "changed-original") f.archivedPlans[0]!.progress = []
    expect(prepareExecutionReplan(f).kind).toBe("blocked")
  })

  it("recognizes duplicate journals across preserved versions of the same occurrence", () => {
    const f = replacedReplanFixture()
    const link = createPlannedSessionLogDraft(f.state, f.state.activePlan.sessions[0]!, "2026-09-29T03:00:01.000Z")!.link
    expect(link.plannedSessionId).not.toBe(f.entries[0]!.plannedSessionLink!.plannedSessionId)
    expect(prepareExecutionReplan({ ...f, entries: [...f.entries, { ...f.entries[0]!, id: "duplicate-current", plannedSessionLink: link }] }).kind).toBe("blocked")
  })

  it("rejects an old link after a content-ID roundtrip, while accepting a genuinely new link", () => {
    const f = replacedReplanFixture(), original = f.state
    const session = original.activePlan.sessions.find(s => s.day === 4 && s.slot === "AM")!
    const oldLink = createPlannedSessionLogDraft(original, session, "2026-09-29T03:00:00.500Z")!.link
    const archives = [...f.archivedPlans, original]
    let current = original
    for (const [catalogId, now] of [["P-BASE-C", "2026-09-29T03:00:01.000Z"], ["P-BASE-B", "2026-09-29T03:00:02.000Z"]]) {
      const result = prepareCatalogReplacement({ ...f, state: current, catalogId: catalogId!, now: now!,
        address: { day: 4, slot: "AM" }, inputs: { eventDistanceM: 5000, experience: current.intake.experienceBand,
          availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] },
        acceptLonger: true, acceptStronger: false })
      if (result.kind !== "ready") throw Error("roundtrip fixture")
      if (current !== original) archives.push(current)
      current = result.proposal.after
    }
    expect(current.activePlan.candidateId).toBe(original.activePlan.candidateId)
    expect(resolveExecutionReplanSource(current, oldLink, archives)).toBeNull()
    expect(resolveExecutionReplanSource(current, oldLink, [])).toBeNull()
    const newLink = createPlannedSessionLogDraft(current, session, "2026-09-29T03:00:03.000Z")!.link
    expect(newLink.plannedSessionId).toBe(oldLink.plannedSessionId)
    expect(resolveExecutionReplanSource(current, newLink, [])?.source).toBe("ACTIVE")
    const ambiguous = { ...newLink, linkedAt: current.catalogReplacement!.acceptedAt }
    expect(resolveExecutionReplanSource(current, ambiguous, archives)).toBeNull()
  })
})
