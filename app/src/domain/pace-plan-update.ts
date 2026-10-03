import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { canonicalPaceDistance, isSegmentPaceReference, roundedPaceSeconds } from "@impl/prescription/record-pace"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { loadAthleteRecords, type AthleteRecord } from "./athlete-records"
import { preparePrescription } from "./plan-candidate-prescription"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { activePlanEditFingerprint, isPaceOnlyCatalogReplacement } from "./active-plan-edit-policy"
import { listPermittedActivePlanEditTargets, prepareActivePlanEdit, latestPaceUpdateMatches,
  type ActivePlanEditPreparation, type ActivePlanEditExclusion, type PrepareActivePlanEditInput } from "./active-plan-edit"
import type { VersionedStoredPlanSession as Session } from "./plan-session-schema"

export type PreparePacePlanUpdateInput = Pick<PrepareActivePlanEditInput,
  "state" | "entries" | "today" | "now" | "timeZone" | "journalGuard" | "paceRecordGuard"> & { record: AthleteRecord }

/** Keep actual/goal meaning distinct, even when displayed numeric targets agree. */
function paceTargetsChanged(before: Session, after: Session): boolean {
  if (before.prescription.kind === "PACE_TARGET" && after.prescription.kind === "PACE_TARGET") {
    return (before.prescription.selectedAnchor.kind === "GOAL") !== (after.prescription.selectedAnchor.kind === "GOAL")
      || roundedPaceSeconds(before.prescription.targetRepSeconds) !== roundedPaceSeconds(after.prescription.targetRepSeconds)
  }
  if (before.prescription.kind !== "RPE_TIME_RANGE" || after.prescription.kind !== "RPE_TIME_RANGE"
    || !before.prescription.catalogWorkout || !after.prescription.catalogWorkout) return false
  const previous = resolveCatalogBinding(before.prescription.catalogWorkout), next = resolveCatalogBinding(after.prescription.catalogWorkout)
  if (!previous || !next) return false
  const kinds = (session: typeof before) => session.prescription.kind === "RPE_TIME_RANGE"
    ? session.prescription.catalogWorkout?.inputs.paceReferences?.map(ref => [ref.segmentId, ref.kind]) ?? null : null
  if (activePlanEditFingerprint(kinds(before)) !== activePlanEditFingerprint(kinds(after))) return true
  const range = (value: { minimum: number; maximum: number } | null) => value
    ? [roundedPaceSeconds(value.minimum), roundedPaceSeconds(value.maximum)] : null
  const targets = (workout: NonNullable<typeof previous>) => workout.steps.filter(step => step.kind === "WORK")
    .map(step => [step.key, range(step.seconds), range(step.paceSecondsPerKm)])
  return activePlanEditFingerprint(targets(previous)) !== activePlanEditFingerprint(targets(next))
}

/** Refresh existing links only. Choosing a new segment/model belongs to the catalog editor. */
export function refreshExistingPaceInputs(session: Session, record: AthleteRecord, today: string): WorkoutCalculationInputs | null {
  if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout
    || record.verificationState === "UNVERIFIED") return null
  const binding = session.prescription.catalogWorkout, inputs = binding.inputs
  const explicit = new Set([...inputs.segmentPaces, ...(inputs.segmentSeconds ?? [])].map(row => row.segmentId))
  const paceReferences = inputs.paceReferences?.map(ref => {
    if (explicit.has(ref.segmentId) || canonicalPaceDistance(ref.eventDistanceM) !== canonicalPaceDistance(record.eventDistanceM)) return ref
    return { ...ref, kind: record.purpose === "RACE_GOAL" ? "GOAL" as const : "ACTUAL" as const,
      recordId: record.id, recordVersion: record.savedAt, performanceSeconds: record.performanceSeconds,
      achievedOn: record.achievedOn, evaluatedOn: today, confirmed: true as const }
  })
  if (paceReferences?.some(ref => !isSegmentPaceReference(ref))) return null
  const legacyLinked = resolveCatalogBinding(binding)?.steps.some(step =>
    step.targetModel === "FIVE_K_REFERENCE" || step.targetModel === "THRESHOLD_REFERENCE")
  const fiveK = inputs.fiveK && legacyLinked && record.eventDistanceM === 5000
    && record.purpose !== "RACE_GOAL" && record.achievedOn !== null
    ? { recordId: record.id, seconds: record.performanceSeconds, achievedAt: record.achievedOn, evaluatedAt: today }
    : inputs.fiveK
  const next = { ...inputs, fiveK, ...(paceReferences === undefined ? {} : { paceReferences }) }
  return activePlanEditFingerprint(inputs) === activePlanEditFingerprint(next) ? null : next
}

/** Preview one atomic batch, never a sequence of single-slot writes. */
export function preparePacePlanUpdate(input: PreparePacePlanUpdateInput, records?: readonly AthleteRecord[]): ActivePlanEditPreparation {
  const permittedTargets = listPermittedActivePlanEditTargets({ ...input, noFixedFutureCommitments: false })
  const excluded: ActivePlanEditExclusion[] = []
  const blocked = (message: string, reasonCode: "TARGET_UNAVAILABLE" | "NO_PACE_CHANGE" = "TARGET_UNAVAILABLE"): ActivePlanEditPreparation => ({ kind: "blocked", reasonCode, message, permittedTargets, excluded })
  const replacements: Session[] = []
  for (const session of input.state.activePlan.sessions) {
    if (session.prescription.kind !== "PACE_TARGET"
      && (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout)) continue
    const exclude = (reasonCode: ActivePlanEditExclusion["reasonCode"], reason: string) => excluded.push({ day: session.day, slot: session.slot, reasonCode, reason })
    if (!permittedTargets.some(target => session.day === target.address.day && session.slot === target.address.slot)) {
      exclude("TARGET_PROTECTED", "지난 날짜이거나 진행·연결 기록이 있어 변경하지 않아요.")
      continue
    }
    if (session.prescription.kind === "PACE_TARGET") {
      const before = session.prescription, safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date(input.now))
      const sourceRecords = records ?? loadAthleteRecords(new Date(input.now))
      const current = sourceRecords.find(r => r.id === input.record.id)
      if (input.record.verificationState === "UNVERIFIED"
        || input.record.eventDistanceM !== before.targetEventDistanceM
        || !current || activePlanEditFingerprint(current) !== activePlanEditFingerprint(input.record)
        || safety.kind !== "passed") {
        exclude("TARGET_UNAVAILABLE", "같은 종목의 현재 실제 기록 또는 직접 고른 목표 기록을 다시 확인해야 해요.")
        continue
      }
      const prepared = preparePrescription(input.state.intake, safety.gate, { selectedRecordId: input.record.id },
        new Date(input.now), { templateId: before.templateId, version: before.templateVersion, fingerprint: before.templateContentFingerprint }, sourceRecords)
      const replacement = prepared.kind === "prepared" ? { ...session, prescription: prepared.prescription } as Session : null
      if (!replacement || !isPaceOnlyCatalogReplacement(session, replacement)) {
        exclude("PROPOSAL_INVALID", "원래 템플릿의 반복·거리·회복을 유지하는 공식 계산을 확인할 수 없어요.")
        continue
      }
      if (!paceTargetsChanged(session, replacement)) {
        exclude("NO_PACE_CHANGE", "계산된 페이스가 같아 기존 기준 기록과 훈련을 그대로 둬요.")
        continue
      }
      replacements.push(replacement)
      continue
    }
    if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) continue
    const inputs = refreshExistingPaceInputs(session, input.record, input.today)
    if (!inputs) {
      exclude("TARGET_UNAVAILABLE", "일치하는 기존 연결이 없거나 직접 지정한 값이며, 갱신이 필요 없을 수도 있어요.")
      continue
    }
    const binding = session.prescription.catalogWorkout
    const replacement = bindCatalogSession(session, binding.catalogId, inputs, binding.acceptedDurationSeconds !== undefined)
    if (!replacement || !isPaceOnlyCatalogReplacement(session, replacement)) {
      exclude("PROPOSAL_INVALID", "기존 구성과 확인한 시간 범위 안에서 이 기록을 적용할 수 없어요.")
      continue
    }
    if (!paceTargetsChanged(session, replacement)) {
      exclude("NO_PACE_CHANGE", "계산된 페이스가 같아 기존 기준 기록과 훈련을 그대로 둬요.")
      continue
    }
    replacements.push(replacement)
  }
  const source = replacements[0]
  if (!source) return excluded.some(row => row.reasonCode === "NO_PACE_CHANGE")
    ? blocked("계산된 페이스가 같아 현재 계획을 그대로 둬요.", "NO_PACE_CHANGE")
    : excluded.some(row => row.reasonCode === "PROPOSAL_INVALID")
      ? blocked("경기 기록은 저장했어요. 새 페이스가 기존 훈련의 구성이나 확인한 시간 범위를 벗어나, 계획은 바꾸지 않았어요.")
      : blocked("이 기록으로 갱신할 수 있는 미기록 훈련의 기존 페이스 연결이 없어요.")
  const result = prepareActivePlanEdit({ ...input, action: "PACE_REFERENCE", source: { day: source.day, slot: source.slot },
    replacements, unstartedConfirmed: true, noFixedFutureCommitments: false })
  return result.kind === "ready" ? { ...result, excluded, proposal: { ...result.proposal, paceSourceRecord: structuredClone(input.record) } }
    : { ...result, excluded }
}

/** Restore only exact snapshots from the latest forward edit, never reconstruct old inputs. */
export function preparePacePlanUndo(input: Omit<PreparePacePlanUpdateInput, "record" | "paceRecordGuard">): ActivePlanEditPreparation {
  const permittedTargets = listPermittedActivePlanEditTargets({ ...input, noFixedFutureCommitments: false })
  const excluded: ActivePlanEditExclusion[] = []
  const blocked = (reason: string): ActivePlanEditPreparation => ({ kind: "blocked", reasonCode: "TARGET_UNAVAILABLE",
    message: reason, permittedTargets, excluded })
  if (!latestPaceUpdateMatches(input.state)) return blocked("마지막 페이스 변경의 현재 계획에서만 되돌릴 수 있어요.")
  const origin = input.state.activePlanEdit!
  const replacements: Session[] = []
  for (const changed of origin.replacements!) {
    const original = origin.baseSessions.find(s => s.day === changed.day && s.slot === changed.slot)!
    if (!permittedTargets.some(target => target.address.day === changed.day && target.address.slot === changed.slot)) {
      excluded.push({ day: changed.day, slot: changed.slot, reasonCode: "TARGET_PROTECTED", reason: "지난 날짜이거나 새 진행·일지가 있어 그대로 보존해요." })
      continue
    }
    replacements.push(structuredClone(original))
  }
  const source = replacements[0]
  if (!source) return blocked("안전하게 되돌릴 수 있는 미기록 훈련이 없어요. 원본 보관 이력은 그대로예요.")
  return { ...prepareActivePlanEdit({ ...input, action: "PACE_REFERENCE", source: { day: source.day, slot: source.slot },
    replacements, undoOf: origin, unstartedConfirmed: true, noFixedFutureCommitments: false }), excluded }
}
