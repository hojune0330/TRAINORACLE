import { generatePlanCandidates } from "../../impl/src/plan-generator/generator"
import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import type { PlanProfile, PlanSession } from "../../impl/src/plan-generator/types"
import { mapD9ResultToRveSignal } from "../../impl/src/rve/signal"
import { decideSafetyGate } from "../../impl/src/safety-gate/gate"
import { createPlanFormation } from "../../app/src/domain/plan-beta-formation"
import { buildPendingOwnerReviewBundleV3 } from "../research/method-owner-review-bundle-v3"
import { METHOD_ADOPTION_PROTOCOLS, assembleProposalSession } from "../research/method-adoption-protocols.mjs"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3, type PrescriptionSequenceV3 } from "../../impl/src/prescription/sequence-v3"

export const PACKET_ID = "B-FIRST-LV-SYNTHETIC-FULL-REVIEW-2026-09-08"
export const CHOICES = [
  ["P-LT-C", "P-VO2-2"], ["P-LT-C", "P-VO2-3"],
  ["P-LT-B", "P-VO2-2"], ["P-LT-B", "P-VO2-3"],
  ["P-LT-C", "K2"], ["P-LT-B", "K2"],
  ["K1", "P-VO2-2"], ["K1", "P-VO2-3"],
] as const
export const LT_CHOICES = [
  ["P-LT-C", "P-LT-C"], ["P-LT-C", "P-LT-B"],
  ["P-LT-B", "P-LT-C"], ["P-LT-B", "P-LT-B"],
  ["P-LT-C", "K2"], ["P-LT-B", "K2"],
  ["K1", "P-LT-C"], ["K1", "P-LT-B"],
] as const
export const reviewHash = (value: unknown) => canonicalJsonFingerprint("trainoracle.first-lv.review-only.v1", value)
const key = (s: { day: number; slot: string }) => `${s.day}:${s.slot}`
function requireValue(ok: unknown, code: string): asserts ok { if (!ok) throw Error(code) }

export function generateOriginal(intent: "LT_INTENT" | "VO2_INTENT", startDate: string) {
  const safetyGate = decideSafetyGate(mapD9ResultToRveSignal({ disposition: "D9_CLEARED",
    blocksPlanGeneration: false, reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"], evidence: [] }))
  const profile: PlanProfile = { eventGroup: "FIVE_K", eventDistanceM: 5000, experienceBand: "DEVELOPING",
    availableTrainingDays: [2, 3, 5, 6, 8, 9], secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "EVENING" }
  const request = { kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate, profile,
    requestedFrameLength: 9.5, formation: createPlanFormation(startDate, profile.availableTrainingDays, profile.experienceBand),
    journalSource: { kind: "NO_USABLE_JOURNAL" }, selectionAuthority: "SELF", selectedEnergyIntent: intent }
  const result = generatePlanCandidates(request)
  requireValue(result.kind === "generated", `ORIGINAL_GENERATION_FAILED:${result.kind}`)
  const candidate = result.candidates.find(c => c.kind === "BALANCED")!
  requireValue(candidate, "BALANCED_ORIGINAL_REQUIRED")
  return { dateSemantics: "SYNTHETIC_TEST_CALENDAR_NOT_ATHLETE_DATES", request, result, candidate,
    requestReviewHash: reviewHash(request), candidateReviewHash: reviewHash(candidate) }
}

type ReviewSession = { day: number; slot: string; role: string; plannedEnergyIntent: string;
  prescription: PlanSession["prescription"] | { kind: "PENDING_REVIEW_SEQUENCE"; protocolId: string;
    executionAuthority: "NONE"; sequence: PrescriptionSequenceV3;
    assembled: ReturnType<typeof assembleProposalSession>; explanationContentFingerprint: string } }

// Absent PM is not an OFF session and never becomes an observed zero.
export function fullGrid(sessions: readonly ReviewSession[]) {
  return Array.from({ length: 19 }, (_, i) => {
    const day = Math.floor(i / 2) + 1, slot = i % 2 ? "PM" : "AM"
    const found = sessions.filter(s => s.day === day && s.slot === slot)
    requireValue(found.length <= 1, "DUPLICATE_ADDRESS")
    return { day, slot, state: found.length ? "GENERATED_OR_PROPOSED_SESSION" : "UNSCHEDULED_NOT_OFF",
      session: found[0] ?? null }
  })
}

export function summarizeSessions(sessions: readonly ReviewSession[]) {
  let exact = 0, rangeMin = 0, rangeMax = 0, main = 0, recovery = 0, support = 0, buildup = 0
  let supportEasy = 0, supportRecovery = 0
  const ranges: string[] = [], off: string[] = [], changed: string[] = [], unknownDistance: string[] = []
  for (const s of sessions) {
    const p = s.prescription, address = key(s)
    if (p.kind === "REST") { off.push(address); continue }
    unknownDistance.push(address)
    if (p.kind === "RPE_TIME_RANGE") {
      ranges.push(address)
      rangeMin += p.durationMinutes.minimum * 60
      rangeMax += p.durationMinutes.maximum * 60
      continue
    }
    requireValue(p.kind === "PENDING_REVIEW_SEQUENCE", "UNSUPPORTED_REVIEW_PRESCRIPTION")
    const parsed = parsePrescriptionSequenceV3(p.sequence)
    requireValue(parsed.kind === "parsed", "INVALID_PROPOSED_SEQUENCE")
    const parts = p.assembled
    requireValue(typeof parts.totalSeconds === "number", "EXACT_TIME_REQUIRED_FOR_FIRST_LV")
    const structural = deriveSequenceV3Totals(parsed.sequence)
    requireValue(structural.warmup.totalSeconds! + structural.main.totalSeconds! + structural.cooldown.totalSeconds!
      === parts.totalSeconds, "SEQUENCE_AND_PARTS_TOTAL_MISMATCH")
    exact += parts.totalSeconds
    support += parts.supportSeconds
    for (const part of parts.main) {
      requireValue(part.unit === "SECONDS", "NO_DISTANCE_CONVERSION")
      if (part.role === "WORK") main += part.value
      else if (part.role === "BUILDUP") buildup += part.value
      else recovery += part.value
    }
    buildup += [...parts.warmup, ...parts.cooldown].filter(p => p.role === "BUILDUP").reduce((a, p) => a + p.value, 0)
    supportEasy += [...parts.warmup, ...parts.cooldown].filter(p => p.role === "EASY_RUN").reduce((a, p) => a + p.value, 0)
    supportRecovery += [...parts.warmup, ...parts.cooldown].filter(p => p.role === "WALK").reduce((a, p) => a + p.value, 0)
    changed.push(address)
  }
  return {
    sessionCount: sessions.length, changedAddresses: changed, originalRangeAddresses: ranges, offAddresses: off,
    exactChangedSessionSeconds: exact,
    proposedMainWorkSeconds: main, proposedMainRecoverySeconds: recovery,
    proposedMainApproachSeconds: 0, proposedSupportSeconds: support,
    supportBuildupSecondsIncludedNotAdditional: buildup,
    supportEasySecondsIncludedNotAdditional: supportEasy,
    supportRecoverySecondsIncludedNotAdditional: supportRecovery,
    originalRpeRangeSeconds: { minimum: rangeMin, maximum: rangeMax },
    wholePlannedTimeEnvelopeSeconds: { minimum: exact + rangeMin, maximum: exact + rangeMax },
    exactWholeFrameSeconds: ranges.length ? null : exact,
    envelopeSemantics: "SUM_OF_ORIGINAL_ESTIMATES_AND_EXACT_PROPOSALS_NOT_MEASURED_OR_A_LIMIT",
    wholeMainWorkSeconds: ranges.some(a => sessions.find(s => key(s) === a)?.role === "QUALITY") ? null : main,
    originalComponentBreakdown: "UNKNOWN_FOR_EVERY_RPE_TIME_RANGE_INCLUDING_SUPPORT",
    wholeSupportSeconds: ranges.length ? null : support,
    wholeRecoverySeconds: ranges.length ? null : recovery + supportRecovery,
    workDistanceM: null, approachDistanceM: null, recoveryDistanceM: null, supportDistanceM: null,
    wholeDistanceM: null, distanceUnknownAddresses: unknownDistance,
    offExerciseSeconds: null, performedWork: "NOT_OBSERVED", physiologicalLoadScore: null,
    explicitPersonalTimeLimitSeconds: null, personalTimeLimitCheck: "NOT_ASSESSABLE_NO_PERSONAL_INPUT",
  }
}

export type SourceBinding = { path: string; sha256: string }
export function buildFirstLvReview(sourceHead: string, sourceFiles: SourceBinding[]) {
  const sources = {
    previous: generateOriginal("LT_INTENT", "2000-01-01"),
    currentLt: generateOriginal("LT_INTENT", "2000-01-11"),
    currentVo2Donor: generateOriginal("VO2_INTENT", "2000-01-11"),
    next: generateOriginal("VO2_INTENT", "2000-01-21"),
  }
  const base = sources.currentLt.candidate, donor = sources.currentVo2Donor.candidate
  const mains = base.sessions.filter(s => s.role === "QUALITY").sort((a, b) => a.day - b.day)
  requireValue(mains.length === 2, "EXACTLY_TWO_ORIGINAL_MAINS_REQUIRED")
  const k1 = mains[0]!, k2 = donor.sessions.find(s => key(s) === key(mains[1]!))!
  requireValue(k2?.role === "QUALITY" && k2.plannedEnergyIntent === "VO2_INTENT", "VO2_DONOR_REQUIRED")
  const bundle = buildPendingOwnerReviewBundleV3()
  const ids = [...new Set(CHOICES.flat().filter(id => !id.startsWith("K")))]
  const cards = ids.map(id => {
    const item = bundle.items.find(item => item.id === id)!
    const protocol = METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)!
    requireValue(item && protocol, "EXACT_CARD_REQUIRED")
    const representation = item.explanation.exactStructure.representation
    requireValue(representation.kind === "represented", "CARD_SEQUENCE_REQUIRED")
    return { id, bundleVersion: bundle.version, bundleContentFingerprint: bundle.contentFingerprint,
      configurationVersion: null, configurationVersionStatus: "NOT_ISSUED",
      proposalReviewHash: reviewHash(protocol), sourceProtocol: protocol, item,
      assembled: assembleProposalSession(protocol), sequence: representation.sequence,
      structuralTotals: deriveSequenceV3Totals(representation.sequence) }
  })
  const proposalSessions = base.sessions.map(s => key(s) === key(k2) ? k2 : s)
  const proposedOriginal = {
    kind: "SYNTHETIC_MIXED_INTENT_REVIEW_ORIGINAL", generatedAsSingleCandidate: false,
    executionAuthority: "NONE", baseCandidateReviewHash: sources.currentLt.candidateReviewHash,
    donorCandidateReviewHash: sources.currentVo2Donor.candidateReviewHash,
    candidateKind: base.kind, sourceMode: base.sourceMode, eventDistanceM: base.eventDistanceM,
    experienceBand: sources.currentLt.request.profile.experienceBand,
    population: "ADULT_SYNTHETIC_REVIEW_CONTEXT_ONLY", requestedSelectionActor: base.selectionAuthority,
    frame: base.frame, continuityContext: base.continuityContext,
    selectedDetailedTemplateRef: base.selectedDetailedTemplateRef,
    mainExposureLedger: base.mainExposureLedger,
    transformation: { address: { day: k2.day, slot: k2.slot },
      fromGeneratorSession: mains[1], toGeneratorSession: k2,
      status: "PROPOSAL_ONLY_NOT_SAME_PURPOSE_RUNTIME_REPLACEMENT",
      operationalTransition: null },
    originals: [{ choice: "K1", generatorSource: "currentLt", session: k1, reviewHash: reviewHash(k1) },
      { choice: "K2", generatorSource: "currentVo2Donor", session: k2, reviewHash: reviewHash(k2) }],
    sessions: proposalSessions, grid: fullGrid(proposalSessions), totals: summarizeSessions(proposalSessions),
  }
  const context = {
    kind: "SYNTHETIC_BOUNDARY_EXAMPLES_NOT_VERIFIED_SUCCESSOR_CHAIN",
    previous: { candidateReviewHash: sources.previous.candidateReviewHash,
      frame: sources.previous.candidate.frame, sessions: sources.previous.candidate.sessions,
      grid: fullGrid(sources.previous.candidate.sessions), totals: summarizeSessions(sources.previous.candidate.sessions) },
    next: { candidateReviewHash: sources.next.candidateReviewHash,
      frame: sources.next.candidate.frame, sessions: sources.next.candidate.sessions,
      grid: fullGrid(sources.next.candidate.sessions), totals: summarizeSessions(sources.next.candidate.sessions) },
    boundaryMainExposures: [
      ...sources.previous.candidate.sessions.filter(s => s.role === "QUALITY").map(s => ({ frame: "PREVIOUS", session: s })),
      ...proposalSessions.filter(s => s.role === "QUALITY").map(s => ({ frame: "CURRENT_PROPOSAL", session: s })),
      ...sources.next.candidate.sessions.filter(s => s.role === "QUALITY").map(s => ({ frame: "NEXT", session: s })),
    ],
    actualBoundaryLink: null, observedMainExposures: null, clockTimes: null, elapsedMainGapHours: null,
    syntheticCalendarSpacing: "10_DAY_TEST_STARTS_WITH_9_5_DAY_FRAMES_NOT_A_CONTIGUOUS_CIVIL_CHAIN",
    competition: { generatorRacePlacement: sources.currentLt.result.racePlacement, actualRaceContext: "NOT_SUPPLIED" },
    taper: "NOT_SUPPLIED", interactionReview: "NOT_GRANTED", safetyReview: "NOT_GRANTED",
    syntheticGateMeaning: "PARSER_FIXTURE_ONLY_NOT_PERSONAL_CLEARANCE",
  }
  const currentContextReviewHash = reviewHash({ sourceHead, sourceFiles, proposedOriginal, context })
  const makeCombinations = (choiceList: readonly (readonly [string, string])[],
    originals: readonly PlanSession[], originalSessions: readonly PlanSession[], contextHash: string, prefix: string) => choiceList.map((choices, index) => {
    const selected = originals.map((original, i) => ({ original, choice: choices[i]! }))
    const transitions = selected.filter(s => !s.choice.startsWith("K")).map(({ original, choice }) => {
      const card = cards.find(c => c.id === choice)!
      return { address: { day: original.day, slot: original.slot }, from: { session: original, reviewHash: reviewHash(original),
        configurationVersion: null, basis: "GENERATOR_RPE_TIME_RANGE_NOT_EXACT_CONFIGURATION" },
        to: { id: card.id, bundleVersion: card.bundleVersion, bundleContentFingerprint: card.bundleContentFingerprint,
          explanationVersion: card.item.explanation.version, explanationContentFingerprint: card.item.explanation.contentFingerprint,
          methodDesignVersion: card.item.explanation.methodDesign.version,
          guidanceVersion: card.item.explanation.exactStructure.representation.guidance.version,
          configurationVersion: null, proposalReviewHash: card.proposalReviewHash, supportRef: card.assembled.supportRef },
        samePurposeInProposedOriginal: true, transitionAuthority: null, rpeBinding: null,
        paceEvidence: null, recordBasis: "NOT_USED", reviewStatus: "PROPOSAL_REQUIRES_EXACT_BINDING",
        originalRpeIsNotProposedSegmentRpe: true }
    })
    const sessions: ReviewSession[] = originalSessions.map(original => {
      const choice = selected.find(s => key(s.original) === key(original))?.choice
      if (!choice || choice.startsWith("K")) return structuredClone(original)
      const card = cards.find(c => c.id === choice)!
      return { ...original, prescription: { kind: "PENDING_REVIEW_SEQUENCE", protocolId: card.id,
        executionAuthority: "NONE", sequence: card.sequence, assembled: card.assembled,
        explanationContentFingerprint: card.item.explanation.contentFingerprint } }
    })
    const content = { id: `${prefix}-${index + 1}`, choices, currentContextReviewHash: contextHash,
      executionAuthority: "NONE", activationState: "REVIEW_ONLY_NOT_ACCEPTED",
      transitions, sessions, grid: fullGrid(sessions), totals: summarizeSessions(sessions),
      wholePlanReviewPolicy: null, operationalScopeFingerprint: null,
      recommendation: "HOLD_OPERATIONAL_ADOPTION_SYNTHETIC_REVIEW_MATERIAL_READY" }
    return { ...content, reviewContentHash: reviewHash(content) }
  })
  const combinations = makeCombinations(CHOICES, [k1, k2], proposalSessions, currentContextReviewHash, "B-FIRST-LV")
  const ltContext = { ...context, boundaryMainExposures: context.boundaryMainExposures.map(exposure =>
    exposure.frame === "CURRENT_PROPOSAL" ? { frame: "CURRENT_GENERATOR_LT", session: mains.find(s => key(s) === key(exposure.session))! } : exposure) }
  const ltContextHash = reviewHash({ sourceHead, sourceFiles, originalCandidate: base, context: ltContext })
  const sameIntentLtReview = {
    kind: "GENERATOR_BASED_SAME_INTENT_LT_REVIEW", generatedAsSingleCandidate: true,
    executionAuthority: "NONE", operationalAdoption: "NOT_GRANTED", originalCandidate: base,
    originalReviewHash: sources.currentLt.candidateReviewHash,
    experienceBand: sources.currentLt.request.profile.experienceBand,
    population: "ADULT_SYNTHETIC_REVIEW_CONTEXT_ONLY", requestedSelectionActor: base.selectionAuthority,
    originals: mains.map((session, i) => ({ choice: `K${i + 1}`, generatorSource: "currentLt", session, reviewHash: reviewHash(session) })),
    grid: fullGrid(base.sessions), totals: summarizeSessions(base.sessions),
    context: ltContext, currentContextReviewHash: ltContextHash,
    combinations: makeCombinations(LT_CHOICES, mains, base.sessions, ltContextHash, "B-FIRST-LL"),
    scope: "EXACT_TWO_EXISTING_LT_ADDRESSES_ONLY_NOT_L_FOUR_METHOD_EXPANSION",
    recommendation: "READY_FOR_BOUNDED_WHOLE_PLAN_CONTENT_REVIEW_NOT_OPERATIONAL_ADOPTION",
  }
  const content = { packetId: PACKET_ID, version: "1", executionAuthority: "NONE", runtimeActivation: false,
    ownerAdoption: "NOT_GRANTED", sourceHead,
    sourceHeadSemantics: "BASELINE_ANCESTOR_PLUS_HASHED_WORKTREE_INPUTS_NOT_COMMIT_CONTAINING_THIS_PACKET",
    sourceHashSemantics: "UTF8_CRLF_TO_LF_ONLY_NO_OTHER_REWRITE_NOT_RAW_FILE_BYTES",
    sourceFiles, sourceBindingHash: reviewHash(sourceFiles),
    sources, bundleIdentity: { version: bundle.version, contentFingerprint: bundle.contentFingerprint }, cards,
    primaryReview: "sameIntentLtReview", sameIntentLtReview,
    proposedOriginal, context, currentContextReviewHash, combinations,
    coverage: { primaryActualGeneratorOriginals: 1, primaryGeneratorBasedLtLayouts: 8,
      comparisonLvLayouts: combinations.length, validOperationalMixedOriginals: 0,
      approvedWholePlans: 0, doubleChange: combinations.filter(c => c.transitions.length === 2).length,
      singleChange: combinations.filter(c => c.transitions.length === 1).length, fixedPairs: false },
    remainingDataGaps: ["GENERATOR_VALID_MIXED_LT_VO2_ORIGINAL_AND_IDENTITY",
      "ACTUAL_PREVIOUS_NEXT_CHAIN_CLOCK_TIMES_MAIN_EXPOSURES_RACE_TAPER",
      "ORIGINAL_RPE_COMPONENT_BREAKDOWN_AND_EXACT_K_TIME_DISTANCE",
      "EXACT_CONTENT_AND_1760_SUPPORT_ADOPTION_NOT_SUPPLIED",
      "VERSIONED_FROM_TO_TRANSITIONS_AND_RPE_BINDINGS_NOT_SUPPLIED",
      "CURRENT_NON_REVOKED_CONFIGURATION_EXPOSURE_INTERACTION_SAFETY_POLICY",
      "PERSONAL_CURRENT_SAFETY_APPLICABILITY_AND_EXPLICIT_TIME_LIMIT",
      "WEEK_WINDOW_COMPLETENESS_AND_DISTANCES_FOR_SOURCE_RATIO_REVIEW",
      "PERSONAL_PACE_MODEL_ADOPTION_AND_CURRENT_RECORD_IF_PACE_PATH_REQUESTED"],
  }
  return structuredClone({ ...content, reviewContentHash: reviewHash(content) })
}

export type FirstLvPacket = ReturnType<typeof buildFirstLvReview>
export function validateFirstLvReview(packet: FirstLvPacket, expected: FirstLvPacket) {
  requireValue(packet.packetId === PACKET_ID, "PACKET_ID")
  requireValue(packet.executionAuthority === "NONE" && !packet.runtimeActivation && packet.ownerAdoption === "NOT_GRANTED", "AUTHORITY_FORBIDDEN")
  requireValue(JSON.stringify(packet.combinations.map(c => c.choices)) === JSON.stringify(CHOICES), "EXACT_EIGHT_IN_ORDER_NO_FIXED_PAIR")
  requireValue(reviewHash(packet.sourceFiles) === expected.sourceBindingHash, "SOURCE_BINDING_DRIFT")
  requireValue(packet.currentContextReviewHash === expected.currentContextReviewHash, "CURRENT_CONTEXT_DRIFT")
  requireValue(reviewHash(packet.sources) === reviewHash(expected.sources), "GENERATOR_OUTPUT_DRIFT")
  requireValue(reviewHash(packet.proposedOriginal) === reviewHash(expected.proposedOriginal), "ORIGINAL_OR_K_DRIFT")
  requireValue(reviewHash(packet.context) === reviewHash(expected.context), "BOUNDARY_CONTEXT_DRIFT")
  requireValue(reviewHash(packet.cards) === reviewHash(expected.cards), "CARD_DOSE_SUPPORT_OR_VERSION_DRIFT")
  requireValue(JSON.stringify(packet.sameIntentLtReview.combinations.map(c => c.choices)) === JSON.stringify(LT_CHOICES), "EXACT_EIGHT_LT_CHOICES")
  requireValue(reviewHash(packet.sameIntentLtReview.originalCandidate) === reviewHash(expected.sources.currentLt.candidate), "ACTUAL_LT_ORIGINAL_DRIFT")
  requireValue(reviewHash(packet.sameIntentLtReview.context) === reviewHash(expected.sameIntentLtReview.context), "LT_BOUNDARY_CONTEXT_DRIFT")
  const all = [...packet.sameIntentLtReview.combinations, ...packet.combinations]
  const expectedAll = [...expected.sameIntentLtReview.combinations, ...expected.combinations]
  for (const [index, combination] of all.entries()) {
    const reference = expectedAll[index]!
    requireValue(reviewHash(combination.sessions) === reviewHash(reference.sessions), "FULL_LAYOUT_OR_DOSE_DRIFT")
    requireValue(reviewHash(combination.transitions) === reviewHash(reference.transitions), "TRANSITION_BINDING_DRIFT")
    requireValue(reviewHash(combination.grid) === reviewHash(fullGrid(combination.sessions)), "SLOT_GRID_DRIFT")
    requireValue(reviewHash(combination.totals) === reviewHash(summarizeSessions(combination.sessions)), "TRUTHFUL_TOTALS_REQUIRED")
    requireValue(combination.wholePlanReviewPolicy === null && combination.operationalScopeFingerprint === null, "NO_FORGED_POLICY_OR_SCOPE")
    const { reviewContentHash, ...content } = combination
    requireValue(reviewContentHash === reviewHash(content), "COMBINATION_HASH_DRIFT")
  }
  const { reviewContentHash, ...content } = packet
  requireValue(reviewContentHash === reviewHash(content), "PACKET_HASH_DRIFT")
  requireValue(reviewHash(packet) === reviewHash(expected), "REGENERATED_PACKET_MISMATCH")
  return { status: "PASS_REVIEW_COVERAGE_ONLY", generatorBasedLtCombinations: packet.sameIntentLtReview.combinations.length,
    syntheticMixedLvCombinations: packet.combinations.length, operationalApproval: false }
}
