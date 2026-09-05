import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { resolveDetailedPrescriptionRuntimeAuthority } from "../../domain/detailed-prescription-runtime-authority"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { parsePrescriptionNotation } from "@impl/prescription/notation"
import { formatTrainingSeconds } from "./labels"
import {
  recommendMethods,
  type MethodFamily,
  type MethodHistoryEntry,
  type MethodReference,
  type RepeatPreference,
} from "@impl/prescription/method-recommendation"
import { parsePrescriptionSequence, type SequenceRecovery } from "@impl/prescription/sequence"
import { loadPlanMethodHistory } from "../../domain/plan-beta-store"
import { resolvePlanMethodMapping } from "../../domain/plan-method-registry"

export type DetailedPlanTemplateOption = {
  readonly ref: PlanBetaIntake["selectedDetailedTemplateRef"] & object
  readonly notation: string
  readonly targetEventDistanceM: PlanBetaIntake["eventDistanceM"]
  readonly trainingFocus: PlannedEnergyIntent
  readonly mainSummary: string
  readonly recoverySummary: string
  readonly preparationSummary: string
  readonly recommended?: boolean
  readonly recommendationReason?: string
  readonly observedPerformedCount?: number
  readonly selectedCount?: number
  readonly method?: MethodReference
  readonly mappingVersion?: string
}

export function resolveDetailedPlanTemplateOption(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus" | "experienceBand">,
  evaluatedAt = new Date().toISOString(),
): DetailedPlanTemplateOption | null {
  return resolveDetailedPlanTemplateOptions(draft, evaluatedAt)[0] ?? null
}

export function resolveDetailedPlanTemplateOptions(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus" | "experienceBand">,
  evaluatedAt = new Date().toISOString(),
  history: readonly MethodHistoryEntry[] = loadPlanMethodHistory(draft.eventDistanceM),
  repeatPreference: RepeatPreference = "NEUTRAL",
): readonly DetailedPlanTemplateOption[] {
  if (draft.eventDistanceM === undefined || draft.trainingFocus === undefined || draft.experienceBand === undefined) return []
  const eventDistanceM = draft.eventDistanceM
  const trainingFocus = draft.trainingFocus
  const experienceBand = draft.experienceBand
  const approvals = DETAILED_PRESCRIPTION_APPROVALS.filter((candidate) => (
    candidate.targetEventDistanceM === eventDistanceM
    && candidate.eligibleExperienceBands.includes(experienceBand)
  ))
  const catalog: MethodFamily[] = []
  const options = approvals.flatMap((approval): DetailedPlanTemplateOption[] => {
    const ref = {
      templateId: approval.templateId,
      version: approval.templateVersion,
      fingerprint: approval.templateContentFingerprint,
    }
    const mapping = resolvePlanMethodMapping(ref)
    if (mapping === null) return []
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: ref,
      targetEventDistanceM: eventDistanceM,
      selectedEnergyIntent: trainingFocus,
      evaluatedAt,
    })
    if (authority.kind !== "authorized") return []
    const parsed = parsePrescriptionNotation(authority.approval.notation)
    if (parsed.kind !== "parsed") return []
    const notation = parsed.notation
    const noRecovery: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }
    const recoveryFor = (seconds: number | null, mode: typeof notation.repetitionRecoveryMode): SequenceRecovery => (
      mode === "NOT_APPLICABLE" ? noRecovery : { seconds, mode }
    )
    const sequence = parsePrescriptionSequence({
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: approval.templateId, label: null,
      warmup: [], cooldown: [], terminalRecovery: noRecovery,
      main: [{ kind: "group", id: "sets", label: null, repeatCount: notation.setCount,
        recoveryAfter: noRecovery, recoveryBetweenRepeats: recoveryFor(notation.setRecoverySeconds, notation.setRecoveryMode),
        children: [{ kind: "segment", id: "work", label: null, repeatCount: notation.repetitionsPerSet,
          work: notation.repetitionDistanceM === null
            ? { kind: "duration", distanceM: null, durationSeconds: notation.repetitionDurationSeconds }
            : { kind: "distance", distanceM: notation.repetitionDistanceM, durationSeconds: null },
          target: { kind: "RACE_PACE", eventDistanceM: notation.paceTargetEventDistanceM, anchorRef: null },
          recoveryAfter: noRecovery,
          recoveryBetweenRepeats: recoveryFor(notation.repetitionRecoverySeconds, notation.repetitionRecoveryMode),
        }],
      }],
    })
    if (sequence.kind !== "parsed") return []
    const configuration = { configurationId: mapping.method.configurationId, version: mapping.method.version, sequence: sequence.sequence }
    const familyIndex = catalog.findIndex(family => family.familyId === mapping.method.familyId)
    if (familyIndex === -1) {
      catalog.push({ familyId: mapping.method.familyId, reviewRef: approval.approvalDecisionId, configurations: [configuration] })
    } else {
      const family = catalog[familyIndex]!
      catalog[familyIndex] = { ...family, configurations: [...family.configurations, configuration] }
    }
    const components = authority.approval.canonicalTemplateContent.operationalComponents
    const warmup = components.warmup
    const cooldown = components.cooldown
    const totalRepetitions = notation.setCount * notation.repetitionsPerSet
    const work = notation.repetitionDistanceM === null
      ? `${notation.repetitionDurationSeconds}초` : `${notation.repetitionDistanceM}m`
    const recovery = [
      ...(notation.repetitionRecoverySeconds === null ? [] : [
        `반복 사이 ${formatTrainingSeconds(notation.repetitionRecoverySeconds)} ${recoveryLabel(notation.repetitionRecoveryMode)}`,
      ]),
      ...(notation.setRecoverySeconds === null ? [] : [
        `세트 사이 ${formatTrainingSeconds(notation.setRecoverySeconds)} ${recoveryLabel(notation.setRecoveryMode)}`,
      ]),
    ]
    return [{
      ref,
      method: mapping.method,
      mappingVersion: mapping.mappingVersion,
      notation: authority.approval.notation,
      targetEventDistanceM: eventDistanceM,
      trainingFocus,
      mainSummary: `${work} ${notation.repetitionsPerSet}회${notation.setCount > 1 ? `씩 ${notation.setCount}세트 · 총 ${totalRepetitions}회` : ""}`,
      recoverySummary: recovery.join(" · "),
      preparationSummary: `준비 ${warmup.easyDurationMinutes}분 RPE ${warmup.rpeMin}-${warmup.rpeMax}, ${warmup.strides.durationSeconds}초 점진 가속 ${warmup.strides.repetitions}회와 사이 ${warmup.strides.recoverySeconds}초 걷기/조깅 · 정리 ${cooldown.easyDurationMinutes}분 RPE ${cooldown.rpeMin}-${cooldown.rpeMax}`,
    }]
  })
  const ranked = recommendMethods({ catalog, assessments: catalog.flatMap(family => family.configurations.map(configuration => ({
    familyId: family.familyId, configurationId: configuration.configurationId, version: configuration.version,
    eligibility: "ELIGIBLE" as const, eligibilityPriority: 0, purposePriority: 0, contextPriority: 0,
  }))), history, repeatPreference })
  if (ranked.kind !== "recommended") return []
  return ranked.eligible.flatMap(method => {
    const option = options.find(item => item.method?.familyId === method.familyId
      && item.method.configurationId === method.configurationId && item.method.version === method.version)
    if (option === undefined) return []
    const isRecommended = ranked.defaults.some(item => (
      item.familyId === method.familyId && item.configurationId === method.configurationId && item.version === method.version
    ))
    const otherFamilies = ranked.eligible.filter(item => item.familyId !== method.familyId)
    const leastPerformed = Math.min(...ranked.eligible.map(item => item.observedPerformedCount))
    const recommendationReason = isRecommended
      ? otherFamilies.length === 0
        ? "현재 조건에서 검토가 끝난 상세 방법"
        : repeatPreference === "PREFER_VARIETY" && method.observedPerformedCount === leastPerformed
          ? "계획 세션의 자기보고 완료 기록이 적은 방법을 먼저 제안"
          : repeatPreference === "PREFER_REPEAT"
            ? "계획 세션의 자기보고 완료 기록이 많은 방법을 먼저 제안"
            : "현재 조건과 목적에 맞는 목록 순서 · 우열을 뜻하지 않아요"
      : undefined
    return [{
      ...option,
      recommended: isRecommended,
      recommendationReason,
      observedPerformedCount: method.observedPerformedCount,
      selectedCount: method.selectedCount,
    }]
  })
}

function recoveryLabel(mode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"): string {
  return { WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", NOT_APPLICABLE: "" }[mode]
}
