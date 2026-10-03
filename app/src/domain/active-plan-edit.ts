import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { isoShift, isValidIsoDate } from "./dates"
import { executionReplanEvidence } from "./execution-replan"
import type { AthleteRecord } from "./athlete-records"
import type { JournalEntry } from "./journal-schema"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { planSessionSchema, type VersionedStoredPlanSession as Session } from "./plan-session-schema"
import { ACTIVE_PLAN_EDIT_POLICY, activePlanEditFingerprint, activePlanEditReceiptSchema, activePlanEditDurationConsentRequired, isPaceOnlyCatalogReplacement, isExactPaceUndoReplacement, replayActivePlanEdit, type ActivePlanEditReceipt } from "./active-plan-edit-policy"

export { ACTIVE_PLAN_EDIT_POLICY } from "./active-plan-edit-policy"
export type ActivePlanEditAddress = Readonly<{ day: number; slot: "AM" | "PM" }>
export type ActivePlanEditAction = "DURATION" | "SWAP" | "CATALOG" | "PACE_REFERENCE"
export type ActivePlanEditReasonCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_PLAN"
  | "NOT_SELF_SELECTED"
  | "UNSTARTED_CONFIRMATION_REQUIRED"
  | "TARGET_PROTECTED"
  | "TARGET_UNAVAILABLE"
  | "NO_PACE_CHANGE"
  | "DURATION_OUT_OF_RANGE"
  | "FIXED_COMMITMENT_UNCONFIRMED"
  | "SCHEDULE_GATE_FAILED"
  | "PROPOSAL_INVALID"

export type ActivePlanEditTarget = Readonly<{
  address: ActivePlanEditAddress
  date: string
  role: Session["role"]
  actions: readonly ActivePlanEditAction[]
  swapTargets: readonly ActivePlanEditAddress[]
}>

export type ActivePlanEditProposal = Readonly<{
  policy: typeof ACTIVE_PLAN_EDIT_POLICY
  action: ActivePlanEditAction
  proposalId: string
  baseStateFingerprint: string
  originalPlanId: string
  newPlanId: string
  createdAt: string
  source: ActivePlanEditAddress
  target: ActivePlanEditAddress | null
  before: PlanBetaStateV3
  after: PlanBetaStateV3
  beforeSessions: readonly Session[]
  afterSessions: readonly Session[]
  paceSourceRecord?: AthleteRecord
}>

export type ActivePlanEditExclusion = Readonly<ActivePlanEditAddress & { reasonCode: ActivePlanEditReasonCode; reason: string }>
export type ActivePlanEditPreparation = (
  | { kind: "ready"; proposal: ActivePlanEditProposal; permittedTargets: readonly ActivePlanEditTarget[] }
  | { kind: "blocked"; reasonCode: ActivePlanEditReasonCode; message: string; permittedTargets: readonly ActivePlanEditTarget[] }
) & { excluded?: readonly ActivePlanEditExclusion[] }

export type PrepareActivePlanEditInput = {
  state: PlanBetaStateV3
  entries: readonly JournalEntry[]
  today: string
  now: string
  /** Explicit athlete confirmation; absence of a journal is not proof of an unstarted session. */
  unstartedConfirmed: boolean
  noFixedFutureCommitments: boolean
  timeZone: string
  journalGuard?: readonly Readonly<{ documentId: string; revision: number }>[] | null
  action: ActivePlanEditAction
  source: ActivePlanEditAddress
  target?: ActivePlanEditAddress
  /** New maximum only. It must stay inside the stored range and above its original minimum. */
  maximumMinutes?: number
  replacement?: Session
  replacements?: readonly Session[]
  undoOf?: NonNullable<ActivePlanEditReceipt["undoOf"]>
  paceRecordGuard?: NonNullable<ActivePlanEditReceipt["paceRecordGuard"]>
  acceptedRpeMaximum?: number | null
  acceptedLongerDuration?: boolean
}

const key = (address: ActivePlanEditAddress) => `${address.day}:${address.slot}`
const same = (a: ActivePlanEditAddress, b: ActivePlanEditAddress) => key(a) === key(b)
export function activePlanEditEvidenceFingerprint(entries: readonly JournalEntry[]): string {
  return activePlanEditFingerprint(executionReplanEvidence(entries))
}
const index = (session: Session) => (session.day - 1) * 2 + (session.slot === "AM" ? 0 : 1)

function editCandidateId(state: PlanBetaStateV3, sessions: readonly Session[], baseCandidateId = state.activePlan.candidateId): string {
  const plan = state.activePlan
  return deriveCandidateId(baseCandidateId, {
    kind: plan.candidateKind, eventDistanceM: plan.eventDistanceM,
    selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef, selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode, selectionAuthority: "SELF",
    frame: plan.frame as Extract<typeof plan.frame, { formationKind: "LOCAL_CIVIL_9_5" }>, sessions,
  })
}

/** Progress may advance, but a different plan or later edit cannot borrow the old undo source. */
export function latestPaceUpdateMatches(state: PlanBetaStateV3): boolean {
  const receipt = state.activePlanEdit
  if (!receipt || receipt.action !== "PACE_REFERENCE" || receipt.undoOf || receipt.startDate !== state.intake.startDate) return false
  const applied = replayActivePlanEdit(receipt)
  return applied !== null && activePlanEditFingerprint(applied) === activePlanEditFingerprint(state.activePlan.sessions)
    && editCandidateId(state, applied, receipt.baseCandidateId) === state.activePlan.candidateId
}

function block(reasonCode: ActivePlanEditReasonCode, message: string, permittedTargets: readonly ActivePlanEditTarget[] = []): ActivePlanEditPreparation {
  return { kind: "blocked", reasonCode, message, permittedTargets }
}

function dateOf(startDate: string, address: ActivePlanEditAddress): string {
  return isoShift(startDate, address.day - 1)
}

function visibleProjectionLength(state: PlanBetaStateV3): 7 | 9 | 10 {
  const frame = state.activePlan.frame
  const length = "projectionLengthDays" in frame ? frame.projectionLengthDays ?? frame.lengthDays : frame.lengthDays
  return Math.ceil(length) as 7 | 9 | 10
}

function dateInTimeZone(instant: string, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(instant))
    const part = (type: string) => parts.find(p => p.type === type)?.value
    const year = part("year"), month = part("month"), day = part("day")
    return year && month && day ? `${year}-${month}-${day}` : null
  } catch { return null }
}

export function journalProtectsActivePlanEditSlot(entries: readonly JournalEntry[], state: PlanBetaStateV3, address: ActivePlanEditAddress): boolean {
  if (!state.intake.startDate) return true
  const date = dateOf(state.intake.startDate!, address)
  return entries.some(entry => {
    if (entry.kind !== "post-session") return false
    const link = entry.plannedSessionLink
    if (link && link.plannedDate === date && link.sessionSlot === address.slot) return true
    if (entry.date !== date) return false
    if (link?.sessionSlot === address.slot) return true
    // Unlinked logs are not absence. Protect a matching explicit AM/PM entry, or all slots
    // that date when its slot cannot establish a unique identity.
    return entry.activitySlot === undefined || entry.activitySlot === "UNSPECIFIED" || entry.activitySlot === "SINGLE"
      || entry.activitySlot === address.slot
  })
}

function protectedAddresses(state: PlanBetaStateV3, entries: readonly JournalEntry[], today: string): Set<string> {
  const protectedKeys = new Set(state.progress.map(p => `${p.sessionDay}:${p.sessionSlot}`))
  for (const session of state.activePlan.sessions) {
    const address = { day: session.day, slot: session.slot }
    if (dateOf(state.intake.startDate!, address) < today || journalProtectsActivePlanEditSlot(entries, state, address)) {
      protectedKeys.add(key(address))
    }
  }
  return protectedKeys
}

function eligible(state: PlanBetaStateV3, entries: readonly JournalEntry[], address: ActivePlanEditAddress, today: string, protectedKeys: Set<string>): boolean {
  const session = state.activePlan.sessions.find(s => same(s, address))
  return session !== undefined && dateOf(state.intake.startDate!, address) >= today
    && !protectedKeys.has(key(address))
}

function withinExistingScheduleGates(before: readonly Session[], after: readonly Session[], state: PlanBetaStateV3): boolean {
  if (new Set(after.map(s => key(s))).size !== after.length) return false
  const byDay = new Map<number, Session[]>()
  for (const session of after) byDay.set(session.day, [...(byDay.get(session.day) ?? []), session])
  for (const sessions of byDay.values()) {
    if (sessions.length > 2 || (sessions.length === 2 && state.intake.secondSessionMode !== "RECOVERY_PM_ALLOWED")) return false
    // The active storage gate has no post-confirmed double-quality review flow yet.
    if (sessions.filter(s => s.role === "QUALITY").length > 1) return false
    if (sessions.some(s => s.role === "QUALITY") && sessions.some(s => s.role === "EASY"
      && (s.prescription.kind !== "RPE_TIME_RANGE" || s.prescription.rpe.minimum < 1 || s.prescription.rpe.maximum > 3))) return false
  }
  const oldMain = before.filter(s => s.role === "QUALITY").map(index).sort((a, b) => a - b)
  const newMain = after.filter(s => s.role === "QUALITY").map(index).sort((a, b) => a - b)
  const oldGaps = oldMain.slice(1).map((p, i) => p - oldMain[i]!)
  return newMain.length === oldMain.length
    && (!oldGaps.length || newMain.slice(1).every((p, i) => p - newMain[i]! >= Math.min(...oldGaps)))
}

function permitted(state: PlanBetaStateV3, entries: readonly JournalEntry[], today: string, protectedKeys: Set<string>, noFixedFutureCommitments: boolean): ActivePlanEditTarget[] {
  const sessions = state.activePlan.sessions
  const maxDay = visibleProjectionLength(state)
  return sessions.filter(source => source.day <= maxDay && eligible(state, entries, source, today, protectedKeys)
    && source.role !== "REST" && ["RPE_TIME_RANGE", "PACE_TARGET"].includes(source.prescription.kind))
    .map(source => {
      const address = { day: source.day, slot: source.slot } as const
      if (source.prescription.kind === "PACE_TARGET") return {
        address, date: dateOf(state.intake.startDate!, address), role: source.role,
        actions: ["PACE_REFERENCE"] as ActivePlanEditAction[], swapTargets: [],
      }
      const swapTargets = noFixedFutureCommitments ? sessions.filter(target => target.day !== source.day
        && target.day <= maxDay
        && target.slot === source.slot && (target.role === "REST" || target.role === "EASY")
        && (target.role !== "REST" || sessions.some(s => s.day === target.day && s.role !== "REST"))
        && eligible(state, entries, target, today, protectedKeys)
        && withinExistingScheduleGates(sessions, sessions.map(s => same(s, address)
          ? { ...target, day: source.day, slot: source.slot } as Session
          : same(s, { day: target.day, slot: target.slot })
            ? { ...source, day: target.day, slot: target.slot } as Session : s), state))
        .map(target => ({ day: target.day, slot: target.slot } as const)) : []
      const actions: ActivePlanEditAction[] = ["CATALOG"]
      if (source.prescription.kind === "RPE_TIME_RANGE") {
        if (!source.prescription.catalogWorkout && source.prescription.durationMinutes.maximum > source.prescription.durationMinutes.minimum) actions.unshift("DURATION")
        if (swapTargets.length) actions.push("SWAP")
      }
      return { address, date: dateOf(state.intake.startDate!, address), role: source.role, actions, swapTargets }
    })
}

export function listPermittedActivePlanEditTargets(input: {
  state: PlanBetaStateV3
  entries: readonly JournalEntry[]
  today: string
  noFixedFutureCommitments: boolean
}): readonly ActivePlanEditTarget[] {
  const parsed = planBetaStateV3Schema.safeParse(input.state)
  if (!parsed.success || !isValidIsoDate(input.today) || !("formationKind" in parsed.data.activePlan.frame)
    || parsed.data.activePlan.selectionActor !== "SELF" || !parsed.data.intake.startDate) return []
  return permitted(parsed.data, input.entries, input.today, protectedAddresses(parsed.data, input.entries, input.today), input.noFixedFutureCommitments)
}

/** Creates an immutable preview. Storage, archival, and the applied-edit receipt belong to the caller. */
export function prepareActivePlanEdit(input: PrepareActivePlanEditInput): ActivePlanEditPreparation {
  if (input.action !== "PACE_REFERENCE" && ("replacements" in input || "undoOf" in input || "paceRecordGuard" in input)) return block("INVALID_INPUT", "여러 훈련의 교체 목록은 페이스 갱신에서만 사용할 수 있어요.")
  const parsed = planBetaStateV3Schema.safeParse(input.state)
  if (!parsed.success || !isValidIsoDate(input.today) || !Number.isFinite(Date.parse(input.now))
    || input.now !== new Date(input.now).toISOString() || !Number.isInteger(input.source.day) || input.source.day < 1
    || !["AM", "PM"].includes(input.source.slot) || typeof input.timeZone !== "string" || input.timeZone.length === 0
    || dateInTimeZone(input.now, input.timeZone) !== input.today) {
    return block("INVALID_INPUT", "현재 계획과 수정 요청을 다시 확인해 주세요.")
  }
  const state = parsed.data
  if (!("formationKind" in state.activePlan.frame) || !state.intake.startDate) return block("UNSUPPORTED_PLAN", "V3 날짜형 계획만 수정할 수 있어요.")
  if (state.activePlan.selectionActor !== "SELF") return block("NOT_SELF_SELECTED", "본인이 선택한 계획에서만 직접 수정할 수 있어요.")
  if (!input.unstartedConfirmed) return block("UNSTARTED_CONFIRMATION_REQUIRED", "대상 훈련이 시작되지 않았음을 확인해 주세요.")

  const protectedKeys = protectedAddresses(state, input.entries, input.today)
  const permittedTargets = permitted(state, input.entries, input.today, protectedKeys, input.noFixedFutureCommitments)
  const projectionLengthDays = visibleProjectionLength(state)
  const source = state.activePlan.sessions.find(s => same(s, input.source))
  if (!source || input.source.day > projectionLengthDays || !eligible(state, input.entries, input.source, input.today, protectedKeys)) {
    return block("TARGET_PROTECTED", "과거 날짜이거나 진행·연결 기록이 있는 훈련은 수정할 수 없어요.", permittedTargets)
  }
  if (source.role === "REST" || (source.prescription.kind !== "RPE_TIME_RANGE"
    && !(input.action === "PACE_REFERENCE" && source.prescription.kind === "PACE_TARGET"))) {
    return block("TARGET_UNAVAILABLE", "이 훈련은 직접 시간 조정 대상이 아니에요.", permittedTargets)
  }

  let target: Session | undefined
  let sessions: Session[]
  if (input.action === "DURATION") {
    if (source.prescription.kind !== "RPE_TIME_RANGE") return block("TARGET_UNAVAILABLE", "시간 범위 훈련만 조정할 수 있어요.", permittedTargets)
    if (source.prescription.catalogWorkout) return block("TARGET_UNAVAILABLE", "계산 카탈로그 훈련은 검토된 구성 교체로 수정해 주세요.", permittedTargets)
    const { minimum, maximum } = source.prescription.durationMinutes
    const nextMaximum = input.maximumMinutes
    if (nextMaximum === undefined || !Number.isFinite(nextMaximum) || nextMaximum < minimum || nextMaximum > maximum || nextMaximum === maximum) {
      return block("DURATION_OUT_OF_RANGE", "시간은 현재 계획에 저장된 범위 안에서만 줄일 수 있어요.", permittedTargets)
    }
    sessions = state.activePlan.sessions.map(s => same(s, input.source) ? {
      ...source,
      prescription: { ...source.prescription, durationMinutes: { minimum, maximum: nextMaximum } },
    } as Session : s)
  } else if (input.action === "SWAP") {
    if (!input.noFixedFutureCommitments) return block("FIXED_COMMITMENT_UNCONFIRMED", "이동할 날짜에 고정 일정이 없는지 확인해 주세요.", permittedTargets)
    const requestedTarget = input.target
    if (!requestedTarget || !Number.isInteger(requestedTarget.day) || requestedTarget.day < 1 || requestedTarget.slot !== input.source.slot) {
      return block("TARGET_UNAVAILABLE", "같은 오전·오후의 기존 휴식 또는 저강도 훈련 날짜만 선택할 수 있어요.", permittedTargets)
    }
    target = state.activePlan.sessions.find(s => same(s, requestedTarget))
    if (!target || target.day > projectionLengthDays || target.day === source.day || (target.role !== "REST" && target.role !== "EASY")
      || (target.role === "REST" && !state.activePlan.sessions.some(s => s.day === target!.day && s.role !== "REST"))
      || !eligible(state, input.entries, requestedTarget, input.today, protectedKeys)) {
      return block("TARGET_PROTECTED", "이동할 날짜에 진행·연결 기록이 있거나 기존 휴식·저강도 칸이 아니에요.", permittedTargets)
    }
    sessions = state.activePlan.sessions.map(s => same(s, input.source)
      ? { ...target!, day: source.day, slot: source.slot } as Session
      : same(s, requestedTarget) ? { ...source, day: target!.day, slot: target!.slot } as Session : s)
    if (!withinExistingScheduleGates(state.activePlan.sessions, sessions, state)) {
      return block("SCHEDULE_GATE_FAILED", "기존 주요 훈련 간격이나 하루 슬롯 조건을 지키는 이동 자리가 없어요.", permittedTargets)
    }
  } else if (input.action === "PACE_REFERENCE") {
    const replacements = input.replacements
    if (input.undoOf && (!latestPaceUpdateMatches(state)
      || activePlanEditFingerprint(input.undoOf) !== activePlanEditFingerprint(state.activePlanEdit))) {
      return block("PROPOSAL_INVALID", "마지막 페이스 변경의 현재 계획에서만 되돌릴 수 있어요.", permittedTargets)
    }
    if (!replacements?.length || replacements.length > 38 || new Set(replacements.map(key)).size !== replacements.length
      || !replacements.some(s => same(s, input.source)) || input.target !== undefined || input.replacement !== undefined
      || input.maximumMinutes !== undefined || input.acceptedRpeMaximum != null || input.acceptedLongerDuration === true) {
      return block("INVALID_INPUT", "페이스를 갱신할 기존 훈련 목록을 다시 확인해 주세요.", permittedTargets)
    }
    for (const replacement of replacements) {
      const old = state.activePlan.sessions.find(s => same(s, replacement))
      if (!old || old.day > projectionLengthDays || !eligible(state, input.entries, replacement, input.today, protectedKeys)) {
        return block("TARGET_PROTECTED", "진행·연결 기록이 있거나 지난 날짜의 훈련은 바꿀 수 없어요.", permittedTargets)
      }
      if (input.undoOf ? !isExactPaceUndoReplacement(input.undoOf, old, replacement) : !isPaceOnlyCatalogReplacement(old, replacement)) {
        return block("PROPOSAL_INVALID", "기존 페이스 기준만 갱신할 수 있어요. 훈련 구성과 확인한 시간 범위는 유지해야 해요.", permittedTargets)
      }
    }
    sessions = state.activePlan.sessions.map(s => replacements.find(replacement => same(s, replacement)) ?? s)
  } else {
    const replacement = input.replacement
    if (source.prescription.kind !== "RPE_TIME_RANGE" || !replacement || replacement.day !== source.day || replacement.slot !== source.slot
      || replacement.role !== source.role || replacement.plannedEnergyIntent !== source.plannedEnergyIntent
      || replacement.prescription.kind !== "RPE_TIME_RANGE" || !replacement.prescription.catalogWorkout) {
      return block("TARGET_UNAVAILABLE", "같은 훈련 목적에 연결된 계산 카탈로그 구성을 선택해 주세요.", permittedTargets)
    }
    const oldRpeMaximum = source.prescription.rpe.maximum
    const newRpeMaximum = replacement.prescription.rpe.maximum
    const acceptedRpeMaximum = newRpeMaximum > oldRpeMaximum ? input.acceptedRpeMaximum : null
    const acceptedLongerDuration = input.acceptedLongerDuration ?? false
    if ((newRpeMaximum > oldRpeMaximum && acceptedRpeMaximum !== newRpeMaximum)
      || (newRpeMaximum <= oldRpeMaximum && input.acceptedRpeMaximum != null)
      || acceptedLongerDuration !== activePlanEditDurationConsentRequired(source, replacement)) {
      return block("TARGET_UNAVAILABLE", "변경된 강도 또는 더 긴 시간은 변경 전후 안내를 확인한 뒤 선택해야 해요.", permittedTargets)
    }
    sessions = state.activePlan.sessions.map(s => same(s, input.source) ? replacement : s)
  }
  if (activePlanEditFingerprint(sessions) === activePlanEditFingerprint(state.activePlan.sessions)) {
    return block("TARGET_UNAVAILABLE", "현재 구성과 같은 변경안은 적용할 필요가 없어요.", permittedTargets)
  }
  if (sessions.some(s => !planSessionSchema.safeParse(s).success)) return block("PROPOSAL_INVALID", "변경안을 기존 계획 형식으로 검증할 수 없어요.", permittedTargets)

  const evidenceFingerprint = activePlanEditEvidenceFingerprint(input.entries)
  const journalGuard = input.journalGuard ?? null
  const baseStateFingerprint = activePlanEditFingerprint({ state, evidenceFingerprint, journalGuard, today: input.today, timeZone: input.timeZone })
  const activePlan = { ...state.activePlan, sessions }
  activePlan.candidateId = editCandidateId(state, sessions)
  const { executionReplan: _executionReplan, catalogReplacement: _catalogReplacement,
    explanationReceipt: _explanationReceipt, ...stateWithoutStaleReceipts } = state
  const targetAddress = target ? { day: target.day, slot: target.slot } as const : null
  const receipt: ActivePlanEditReceipt = {
    version: 1, policy: ACTIVE_PLAN_EDIT_POLICY, trigger: "EXPLICIT_PLAN_EDIT", action: input.action,
    source: input.source, target: targetAddress, baseStateFingerprint,
    baseCandidateId: state.activePlan.candidateId, baseSessions: structuredClone([...state.activePlan.sessions]),
    protectedSlots: [...protectedKeys].flatMap(item => {
      const [day, slot] = item.split(":")
      return day && ["AM", "PM"].includes(slot ?? "") ? [{ day: Number(day), slot: slot as "AM" | "PM" }] : []
    }),
    startDate: state.intake.startDate, projectionLengthDays, today: input.today, timeZone: input.timeZone,
    unstartedConfirmed: true, evidenceFingerprint, journalGuard: journalGuard === null ? null : [...journalGuard],
    noFixedFutureCommitments: input.noFixedFutureCommitments,
    maximumMinutes: input.action === "DURATION" ? input.maximumMinutes ?? null : null,
    replacement: input.action === "CATALOG" ? input.replacement ?? null : null,
    ...(input.action === "PACE_REFERENCE" ? { replacements: structuredClone([...(input.replacements ?? [])]) } : {}),
    ...(input.undoOf === undefined ? {} : { undoOf: structuredClone(input.undoOf) }),
    ...(input.paceRecordGuard === undefined ? {} : { paceRecordGuard: structuredClone(input.paceRecordGuard) }),
    acceptedRpeMaximum: input.action === "CATALOG" && input.acceptedRpeMaximum != null ? input.acceptedRpeMaximum : null,
    acceptedLongerDuration: input.action === "CATALOG" ? input.acceptedLongerDuration ?? false : false,
    acceptedAt: input.now,
  }
  if (!activePlanEditReceiptSchema.safeParse(receipt).success) return block("PROPOSAL_INVALID", "변경 확인 정보를 검증할 수 없어요.", permittedTargets)
  const afterParsed = planBetaStateV3Schema.safeParse({ ...stateWithoutStaleReceipts, activePlan, activePlanEdit: receipt })
  if (!afterParsed.success) return block("PROPOSAL_INVALID", "변경안이 전체 계획 검증을 통과하지 못했어요.", permittedTargets)
  const after = afterParsed.data
  const action = input.action
  const proposalId = activePlanEditFingerprint({ policy: ACTIVE_PLAN_EDIT_POLICY, action, baseStateFingerprint,
    source: input.source, target: targetAddress, afterCandidateId: after.activePlan.candidateId, createdAt: input.now })
  return { kind: "ready", permittedTargets, proposal: {
    policy: ACTIVE_PLAN_EDIT_POLICY, action, proposalId, baseStateFingerprint,
    originalPlanId: state.activePlan.candidateId, newPlanId: after.activePlan.candidateId,
    createdAt: input.now, source: input.source, target: targetAddress,
    before: state, after, beforeSessions: state.activePlan.sessions, afterSessions: sessions,
  } }
}
