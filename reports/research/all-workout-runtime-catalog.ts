import { buildPurposeSupplyCatalog } from "./method-purpose-supply-v3"
import { buildExpandedWorkoutCatalog, EXPANDED_SOURCES } from "./expanded-workout-catalog-v3"
import { representPendingCoachingWholeSessionV3 } from "./method-proposal-sequence-v3"
import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import type { SequenceNodeV3 } from "../../impl/src/prescription/sequence-v3"

const leaves = (nodes: readonly SequenceNodeV3[]): Extract<SequenceNodeV3, { kind: "segment" }>[] =>
  nodes.flatMap(n => n.kind === "group" ? leaves(n.children) : [n])

/** Build a separate reviewed calculation artifact; never rewrite research sources. */
export function buildAllWorkoutRuntimeCatalog() {
  const original = buildPurposeSupplyCatalog()
  const support = representPendingCoachingWholeSessionV3(original.find(c => c.id === "P-LT-C")!.exactStructure)
  if (support.kind !== "represented") throw Error("SUPPORT_MISSING")
  const rows = [
    ...original.map(c => {
      const full = representPendingCoachingWholeSessionV3(c.exactStructure, c.id.startsWith("P-INTRO-") ? "INTRO_COMPARISON" : "EXISTING")
      const sequence = full.kind === "represented" ? full.sequence : null
      return { id: c.id, name: c.name, family: c.family, methodGroup: `${c.family}:${c.method}`,
        sourceFingerprint: c.contentFingerprint, sequence,
        segments: sequence ? leaves(sequence.main).map(n => ({ segmentId: n.id,
          intent: n.role === "BUILDUP" ? "TECHNIQUE" : c.family,
          modality: c.family === "REC" ? "WALK" : "RUN", terrain: "FLAT" })) : [],
        eventDistances: [...c.scope.eventDistances], experience: c.qualification === "HOLD_FIRST_RELEASE" ? ["EXPERIENCED"] : [...c.scope.experience],
        requirements: [...(c.requires.accelerationSpace ? ["ACCELERATION_AND_DECELERATION_SPACE"] : []),
          ...(c.qualification === "HOLD_FIRST_RELEASE" ? ["HIGH_INTENSITY_REPETITION_EXPERIENCE"] : [])],
        hold: null,
        explanation: { purpose: c.explanation.purpose, energySupply: c.explanation.energySupply,
          work: c.explanation.work, recovery: c.explanation.recovery, tradeoff: c.explanation.tradeoff,
          expected: c.explanation.expected, limitations: c.explanation.limitations, observation: c.explanation.observation },
        sourceRefs: c.explanation.generalSources.map(s => s.url),
      }
    }),
    ...buildExpandedWorkoutCatalog().map(c => ({ id: c.id, name: c.name, family: c.family,
      methodGroup: `${c.family}:${c.methodGroup}`, sourceFingerprint: c.fingerprint,
      sequence: { ...c.sequence,
        warmup: ["BASE", "REC"].includes(c.family) ? [] : support.sequence.warmup,
        cooldown: ["BASE", "REC"].includes(c.family) ? [] : support.sequence.cooldown },
      segments: c.segmentContexts, eventDistances: c.proposedScope.eventDistancesM, experience: c.proposedScope.experience,
      requirements: c.requiredReview.filter(r => !["EXACT_DOSE_AND_POPULATION", "OWNER_FINAL_ADOPTION", "WARMUP_COOLDOWN_BINDING",
        "CURRENT_SAFETY_AND_AUTHORITY", "FRAME_AND_NEIGHBOUR_SESSIONS", "PERSONAL_PACE_OR_EFFORT_BINDING"].includes(r))
        .map(r => r === "COMPLEX_SESSION_REVIEW" ? "COMPOUND_TRAINING_EXPERIENCE" : r),
      hold: null,
      explanation: { purpose: c.explanation.purpose, energySupply: c.explanation.energySupply,
        work: c.explanation.configurationReason, recovery: c.recoveryContexts.map(r => r.reason).filter((r, i, a) => a.indexOf(r) === i).join(" ") || "구간 사이 별도 회복 없음.",
        tradeoff: c.explanation.tradeoff, expected: c.explanation.expectations,
        limitations: c.explanation.limitations, observation: c.explanation.observation },
      sourceRefs: c.explanation.sourceIds.map(id => EXPANDED_SOURCES[id].url),
    })),
  ].map(row => ({ ...row, version: "1.0.0", reviewRef: "specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md",
    fingerprint: canonicalJsonFingerprint("trainoracle.all-workout-catalog.v1", row) }))
  if (rows.length !== 117 || new Set(rows.map(r => r.id)).size !== rows.length) throw Error("CATALOG_COVERAGE_CHANGED")
  return { version: "1.0.0", decision: "OWNER_DIRECTED_ALL_WORKOUT_CONNECTION_20260930", rows }
}
