import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { loadReview, output, root, sha, sourceHash } from "./first-lt-vo2-review.mjs"

const { module: review, packet: current } = await loadReview()
const packet = JSON.parse(readFileSync(output, "utf8"))
const mutations = {
  FIXED_PAIR: p => { p.combinations.splice(1, 1) },
  DOSE: p => { p.combinations[0].sessions.find(s => s.prescription.kind === "PENDING_REVIEW_SEQUENCE").prescription.sequence.main[0].repeatCount++ },
  SUPPORT: p => { p.cards[0].assembled.supportSeconds *= 2 },
  UNKNOWN_ZERO: p => { p.combinations[4].totals.exactWholeFrameSeconds = 0 },
  BOUNDARY: p => { p.context.next.sessions.pop() },
  CONTEXT: p => { p.currentContextReviewHash = "sha256:" + "0".repeat(64) },
  SOURCE: p => { p.sourceFiles[0].sha256 = "sha256:" + "0".repeat(64) },
  AUTHORITY: p => { p.executionAuthority = "EXECUTE" },
}
const injected = process.env.FIRST_LV_MUTATION
if (injected) {
  assert.ok(mutations[injected], "known fixture defect only")
  mutations[injected](packet)
}

test("FIRST-LV full packet validator accepts only current reproduced review material", () => {
  assert.deepEqual(review.validateFirstLvReview(packet, current), {
    status: "PASS_REVIEW_COVERAGE_ONLY", generatorBasedLtCombinations: 8, syntheticMixedLvCombinations: 8, operationalApproval: false })
})

test("FIRST-LV exact eight ordered choices match packet section 7 including all partial choices", () => {
  const source = readFileSync(resolve(root, "reports/review/TRAINING_ADOPTION_READY_PACKET_2026-09-08.md"), "utf8")
  const section = source.split("## 7. ")[1].split("## 8. ")[0]
  const rows = section.split(/\r?\n/).filter(line => /^\| [1-8] \|/.test(line))
  const expected = rows.map(line => line.split("|").slice(2, 4).map(x => x.trim()
    .replace("원본 K1 유지", "K1").replace("원본 K2 유지", "K2")))
  assert.equal(expected.length, 8)
  assert.deepEqual(packet.combinations.map(c => c.choices), expected)
  assert.equal(new Set(packet.combinations.map(c => c.reviewContentHash)).size, 8)
  assert.deepEqual(packet.combinations.map(c => c.transitions.length), [2, 2, 2, 2, 1, 1, 1, 1])
})

test("FIRST-LL primary eight use one genuine LT generator baseline including repeated and ordered choices", () => {
  const primary = packet.sameIntentLtReview
  assert.equal(primary.generatedAsSingleCandidate, true)
  assert.deepEqual(primary.originalCandidate, packet.sources.currentLt.candidate)
  assert.deepEqual(primary.combinations.map(c => c.choices), [
    ["P-LT-C", "P-LT-C"], ["P-LT-C", "P-LT-B"], ["P-LT-B", "P-LT-C"], ["P-LT-B", "P-LT-B"],
    ["P-LT-C", "K2"], ["P-LT-B", "K2"], ["K1", "P-LT-C"], ["K1", "P-LT-B"]])
  assert.equal(new Set(primary.combinations.map(c => c.reviewContentHash)).size, 8)
  assert.notEqual(primary.currentContextReviewHash, packet.currentContextReviewHash)
  for (const [index, c] of primary.combinations.entries()) {
    assert.equal(c.sessions.length, 16)
    assert.equal(c.grid.length, 19)
    assert.deepEqual(c.sessions.filter(s => s.role === "QUALITY").map(s => s.plannedEnergyIntent), ["LT_INTENT", "LT_INTENT"])
    for (const original of primary.originalCandidate.sessions) {
      if (!c.transitions.some(t => t.address.day === original.day && t.address.slot === original.slot)) {
        assert.deepEqual(c.sessions.find(s => s.day === original.day && s.slot === original.slot), original)
      }
    }
    assert.equal(c.totals.exactChangedSessionSeconds, [5920, 5980, 5980, 6040, 2960, 3020, 2960, 3020][index])
    assert.equal(c.totals.exactWholeFrameSeconds, null)
    for (const t of c.transitions) {
      assert.equal(t.from.session.plannedEnergyIntent, "LT_INTENT")
      assert.ok(["P-LT-C", "P-LT-B"].includes(t.to.id))
      assert.equal(t.rpeBinding, null)
    }
  }
})

test("FIRST-LL primary validator rejects donor substitution and fixed pair removal", () => {
  const altered = structuredClone(current)
  altered.sameIntentLtReview.originalCandidate = altered.sources.currentVo2Donor.candidate
  assert.throws(() => review.validateFirstLvReview(altered, current), /ACTUAL_LT_ORIGINAL_DRIFT/)
  const missing = structuredClone(current)
  missing.sameIntentLtReview.combinations.splice(1, 1)
  assert.throws(() => review.validateFirstLvReview(missing, current), /EXACT_EIGHT_LT_CHOICES/)
})

test("FIRST-LV actual generator outputs stay unchanged and cannot be called a mixed original", () => {
  for (const [name, source] of Object.entries(packet.sources)) {
    const regenerated = review.generateOriginal(source.request.selectedEnergyIntent, source.request.formation.slots[0].localDayKey)
    assert.deepEqual(source, regenerated, name)
    assert.equal(source.candidate.sessions.length, 16)
    assert.deepEqual(source.candidate.sessions.filter(s => s.role === "QUALITY").map(s => [s.day, s.slot]), [[3, "PM"], [9, "PM"]])
    assert.equal(new Set(source.candidate.sessions.filter(s => s.role === "QUALITY").map(s => s.plannedEnergyIntent)).size, 1)
    assert.equal(source.candidate.selectedDetailedTemplateRef, null)
    assert.equal(source.candidate.continuityContext.kind, "NO_PREVIOUS_FRAME_CONTEXT")
  }
  assert.equal(packet.proposedOriginal.generatedAsSingleCandidate, false)
  assert.equal(packet.proposedOriginal.transformation.status, "PROPOSAL_ONLY_NOT_SAME_PURPOSE_RUNTIME_REPLACEMENT")
  assert.equal(packet.coverage.validOperationalMixedOriginals, 0)
})

test("FIRST-LV every full grid preserves BASE REC OFF and absent PM without manufacturing sessions", () => {
  for (const combination of packet.combinations) {
    assert.equal(combination.sessions.length, 16)
    assert.equal(combination.grid.length, 19)
    assert.equal(combination.grid.filter(s => s.state === "UNSCHEDULED_NOT_OFF").length, 3)
    assert.equal(combination.sessions.filter(s => s.role === "REST").length, 4)
    assert.equal(combination.sessions.filter(s => s.role === "EASY" && s.plannedEnergyIntent === "BASE_INTENT").length, 4)
    assert.equal(combination.sessions.filter(s => s.role === "EASY" && s.plannedEnergyIntent === "RECOVERY_INTENT").length, 6)
    for (const original of packet.proposedOriginal.sessions) {
      const changed = combination.transitions.some(t => t.address.day === original.day && t.address.slot === original.slot)
      if (!changed) assert.deepEqual(combination.sessions.find(s => s.day === original.day && s.slot === original.slot), original)
    }
    for (let day = 1; day <= 10; day++) assert.ok(combination.sessions.filter(s => s.day === day && s.role === "QUALITY").length <= 1)
  }
})

test("FIRST-LV exact dose recovery support and versions are current card data not invented versions", () => {
  const source = JSON.parse(readFileSync(resolve(root, "reports/review/METHOD_OWNER_REVIEW_BUNDLE_V3.json"), "utf8"))
  const expected = { "P-LT-C": [1200, 0, 2960], "P-LT-B": [1200, 60, 3020],
    "P-VO2-2": [720, 300, 2780], "P-VO2-3": [900, 480, 3140] }
  for (const card of packet.cards) {
    assert.deepEqual(card.item, source.items.find(i => i.id === card.id))
    assert.equal(card.configurationVersion, null)
    assert.equal(card.item.explanation.version, "0.5")
    assert.equal(card.item.explanation.methodDesign.version, "0.1")
    assert.equal(card.item.explanation.exactStructure.representation.guidance.version, "0.3")
    assert.deepEqual(card.assembled.supportRef, { id: "P-SUPPORT-MAIN-01", version: "0.2" })
    assert.equal(card.assembled.supportSeconds, 1760)
    assert.deepEqual([card.structuralTotals.main.workSeconds, card.structuralTotals.main.recoverySeconds, card.assembled.totalSeconds], expected[card.id])
    assert.equal(card.structuralTotals.warmup.buildupSeconds, 80)
    assert.equal(card.structuralTotals.warmup.recoverySeconds, 180)
    assert.deepEqual(card.item.explanation.personalEvidence, [])
  }
})

test("FIRST-LV truthful full-frame totals distinguish partial sums ranges K and unknown distance", () => {
  const wholeRanges = [[18340, 25540], [18700, 25900], [18400, 25600], [18760, 25960],
    [17060, 25160], [17120, 25220], [16880, 24980], [17240, 25340]]
  const exactChanges = [5740, 6100, 5800, 6160, 2960, 3020, 2780, 3140]
  for (const [i, c] of packet.combinations.entries()) {
    assert.deepEqual(Object.values(c.totals.wholePlannedTimeEnvelopeSeconds), wholeRanges[i])
    assert.equal(c.totals.exactChangedSessionSeconds, exactChanges[i])
    assert.equal(c.totals.exactWholeFrameSeconds, null)
    assert.equal(c.totals.wholeDistanceM, null)
    assert.equal(c.totals.offExerciseSeconds, null)
    assert.equal(c.totals.explicitPersonalTimeLimitSeconds, null)
    assert.equal(c.totals.wholeSupportSeconds, null)
    assert.equal(c.totals.originalRangeAddresses.length, i < 4 ? 10 : 11)
    assert.equal(c.totals.proposedSupportSeconds, c.transitions.length * 1760)
    assert.equal(c.totals.supportBuildupSecondsIncludedNotAdditional, c.transitions.length * 80)
    assert.equal(c.totals.supportRecoverySecondsIncludedNotAdditional, c.transitions.length * 180)
    if (i >= 4) assert.equal(c.totals.wholeMainWorkSeconds, null)
  }
})

test("FIRST-LV previous and next full frames are concrete synthetic context not claimed continuity", () => {
  for (const name of ["previous", "next"]) {
    assert.deepEqual(packet.context[name].sessions, packet.sources[name].candidate.sessions)
    assert.equal(packet.context[name].grid.length, 19)
  }
  assert.equal(packet.context.boundaryMainExposures.length, 6)
  assert.equal(packet.context.actualBoundaryLink, null)
  assert.equal(packet.context.elapsedMainGapHours, null)
  assert.equal(packet.context.observedMainExposures, null)
  assert.equal(packet.context.taper, "NOT_SUPPLIED")
})

test("FIRST-LV source hashes bind LF-normalized content and never masquerade as policy or approval", () => {
  for (const binding of packet.sourceFiles) assert.equal(binding.sha256, sourceHash(readFileSync(resolve(root, binding.path))), binding.path)
  assert.equal(packet.executionAuthority, "NONE")
  assert.equal(packet.ownerAdoption, "NOT_GRANTED")
  for (const c of packet.combinations) {
    assert.equal(c.wholePlanReviewPolicy, null)
    assert.equal(c.operationalScopeFingerprint, null)
    for (const t of c.transitions) { assert.equal(t.rpeBinding, null); assert.equal(t.transitionAuthority, null) }
  }
  const encoded = JSON.stringify(packet)
  for (const field of ["athleteId", "anchorRef", "performanceSeconds", "scopeFingerprint", "rawMemo", "privateNote"]) {
    assert.ok(!encoded.includes(`"${field}":`), field)
  }
})

test("FIRST-LV source normalization tolerates Git CRLF only while preserving content drift", () => {
  assert.equal(sourceHash(Buffer.from("one\r\ntwo\r\n")), sourceHash(Buffer.from("one\ntwo\n")))
  assert.notEqual(sha(Buffer.from("one\r\n")), sha(Buffer.from("one\n")))
  assert.notEqual(sourceHash(Buffer.from("one \n")), sourceHash(Buffer.from("one\n")))
  assert.notEqual(sourceHash(Buffer.from("two\n")), sourceHash(Buffer.from("one\n")))
})

for (const [name, mutate] of Object.entries(mutations)) test(`FIRST-LV validator rejects injected ${name}`, () => {
  const altered = structuredClone(current)
  mutate(altered)
  assert.throws(() => review.validateFirstLvReview(altered, current))
})
