import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { isoShift, isValidIsoDate } from "./dates"
import type { JournalEntry } from "./journal-schema"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { executionReplanEvidence, replanFingerprint } from "./execution-replan"
import { replayCatalogReplacement, type CatalogReplacementReceipt } from "./catalog-replacement-policy"

export type CatalogReplacementProposal = { before: PlanBetaStateV3; after: PlanBetaStateV3 }
export type CatalogReplacementPreparation = { kind: "ready"; proposal: CatalogReplacementProposal } | { kind: "blocked"; message: string }
export function journalProtectsCatalogSlot(entry: JournalEntry, date: string, slot: "AM" | "PM") {
  if (entry.kind !== "post-session") return false
  return entry.date === date && (!["AM", "PM"].includes(entry.activitySlot ?? "") || entry.activitySlot === slot || entry.plannedSessionLink?.sessionSlot === slot)
    || entry.plannedSessionLink?.plannedDate === date && entry.plannedSessionLink.sessionSlot === slot
}
export function catalogProtectedSlots(state: PlanBetaStateV3, entries: readonly JournalEntry[], today: string) {
  return state.activePlan.sessions.filter(s => {
    const date = isoShift(state.intake.startDate!, s.day - 1)
    return date <= today || state.progress.some(p => p.sessionDay === s.day && p.sessionSlot === s.slot)
      || entries.some(e => journalProtectsCatalogSlot(e, date, s.slot))
  }).map(s => ({ day: s.day, slot: s.slot }))
}
export function prepareCatalogReplacement(input: {
  state: PlanBetaStateV3; entries: readonly JournalEntry[]; today: string; now: string;
  address: { day: number; slot: "AM" | "PM" }; catalogId: string; inputs: WorkoutCalculationInputs;
  acceptStronger: boolean; acceptLonger: boolean; journalGuard: CatalogReplacementReceipt["journalGuard"];
  timeZone?: string;
}): CatalogReplacementPreparation {
  const blocked = (message: string): CatalogReplacementPreparation => ({ kind: "blocked", message })
  const parsed = planBetaStateV3Schema.safeParse(input.state)
  if (!parsed.success || !isValidIsoDate(input.today) || !Number.isFinite(Date.parse(input.now))) return blocked("현재 계획을 다시 불러와 주세요.")
  const state = parsed.data, active = state.activePlan
  if (!state.intake.startDate || active.selectionActor !== "SELF" || !("formationKind" in active.frame)
    || state.progress.some(p => p.state === "PAIN_CHECKIN")) return blocked("시작 날짜와 몸 상태, 계획 변경 권한을 먼저 확인해 주세요.")
  const source = active.sessions.find(s => s.day === input.address.day && s.slot === input.address.slot)
  if (!source || source.prescription.kind !== "RPE_TIME_RANGE"
    || source.day > Math.ceil(active.frame.projectionLengthDays ?? active.frame.lengthDays)) return blocked("이 훈련은 기존 전용 조정 경로를 사용해 주세요.")
  const protectedSlots = catalogProtectedSlots(state, input.entries, input.today)
  if (protectedSlots.some(s => s.day === source.day && s.slot === source.slot)) return blocked("오늘과 지난 훈련, 기록을 남긴 훈련은 바꾸지 않아요.")
  const replacement = bindCatalogSession(source, input.catalogId, input.inputs, input.acceptLonger)
  if (!replacement || replacement.prescription.kind !== "RPE_TIME_RANGE") return blocked("이 일정의 목적과 조건에 맞는 구성을 골라 주세요.")
  const stronger = replacement.prescription.rpe.maximum > source.prescription.rpe.maximum
  const longer = replacement.prescription.durationMinutes.maximum > source.prescription.durationMinutes.maximum
  if (stronger && !input.acceptStronger || longer && !input.acceptLonger) return blocked("바뀌는 강도와 전체 시간을 확인해 주세요.")
  const receipt: CatalogReplacementReceipt = { version: 1, policy: "manual-catalog-replacement-v1", trigger: "EXPLICIT_CATALOG_SELECTION",
    source: { day: input.address.day, slot: input.address.slot }, replacement, baseStateFingerprint: replanFingerprint(state), baseCandidateId: active.candidateId,
    baseSessions: structuredClone([...active.sessions]), protectedSlots, startDate: state.intake.startDate,
    timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    today: input.today, evidenceFingerprint: replanFingerprint(executionReplanEvidence(input.entries)), journalGuard: input.journalGuard,
    acceptedRpeMaximum: stronger ? replacement.prescription.rpe.maximum : null, acceptedLongerDuration: longer, acceptedAt: input.now }
  const sessions = replayCatalogReplacement(receipt)
  if (!sessions) return blocked("변경할 구성이 원래 훈련과 같거나 적용 조건을 충족하지 않아요.")
  const candidateId = deriveCandidateId(active.candidateId, { kind: active.candidateKind, eventDistanceM: active.eventDistanceM,
    selectedDetailedTemplateRef: active.selectedDetailedTemplateRef, selectedEnergyIntent: active.selectedEnergyIntent,
    sourceMode: active.sourceMode, selectionAuthority: "SELF", frame: active.frame, sessions })
  const { executionReplan: _oldReplan, catalogReplacement: _oldReplacement, explanationReceipt: _oldExplanation, ...base } = state
  const next = planBetaStateV3Schema.safeParse({ ...base, activePlan: { ...active, candidateId, sessions }, catalogReplacement: receipt })
  return next.success ? { kind: "ready", proposal: { before: state, after: next.data } } : blocked("현재 계획 전체와 맞지 않아 변경하지 않았어요.")
}
