import { canonicalJsonFingerprint, deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { isoShift, isValidIsoDate } from "./dates"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { resolveCurrentPlannedSession } from "./planned-session-link"
import { reviewPlanExecution } from "./plan-execution-review"
import { EXECUTION_REPLAN_POLICY, replayExecutionReplan, replanKey, type ReplanAction, type ExecutionReplanReceipt } from "./execution-replan-policy"

export const replanFingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.execution-replan.v1", value)
export type ExecutionReplanProposal = {
  readonly id: string; readonly action: ReplanAction; readonly title: string; readonly reason: string;
  readonly before: PlanBetaStateV3; readonly after: PlanBetaStateV3;
}
export type ReplanPreparation = { kind: "ready"; proposals: ExecutionReplanProposal[]; unavailable: { action: ReplanAction; reason: string }[] }
  | { kind: "blocked"; message: string }

/** Explicit allowlist: private memo/title/exercise names and even their lengths are absent. */
export function executionReplanEvidence(entries: readonly JournalEntry[]) {
  return entries.map(e => ({ id: e.id, kind: e.kind, date: e.date,
    ...(e.kind === "post-session" ? { link: e.plannedSessionLink ?? null, outcome: e.activityOutcome ?? null,
      slot: e.activitySlot ?? null, pain: e.painCheckStatus ?? null, painParts: e.painParts ?? [],
      relation: e.planExecutionRelation ?? null, waiting: e.objectiveDataState ?? null,
      rpe: e.fieldProvenance?.rpe?.provenance === "EXPLICIT" ? e.rpe : null,
      distance: e.fieldProvenance?.distanceKm?.provenance === "EXPLICIT" ? e.distanceKm : null,
      duration: e.fieldProvenance?.durationMin?.provenance === "EXPLICIT" ? e.durationMin : null,
      ...(e.exerciseLog?.plannedRepetitions ? { plannedRepetitions: {
        version: e.exerciseLog.plannedRepetitions.version, source: e.exerciseLog.plannedRepetitions.source,
        plannedSessionId: e.exerciseLog.plannedRepetitions.plannedSessionId,
        sessionContentFingerprint: e.exerciseLog.plannedRepetitions.sessionContentFingerprint,
        results: e.exerciseLog.plannedRepetitions.results.map(row => ({ set: row.set, repetition: row.repetition,
          distanceM: row.distanceM ?? null, seconds: row.seconds ?? null, recoverySeconds: row.recoverySeconds ?? null,
          recoveryMode: row.recoveryMode ?? null })).sort((a, b) => a.set - b.set || a.repetition - b.repetition),
      } } : {}),
      ...(e.exerciseLog?.plannedSegments ? { plannedSegments: {
        version: 1, source: "SELF_REPORTED", plannedSessionId: e.exerciseLog.plannedSegments.plannedSessionId,
        sessionContentFingerprint: e.exerciseLog.plannedSegments.sessionContentFingerprint,
        calculationFingerprint: e.exerciseLog.plannedSegments.calculationFingerprint,
        results: e.exerciseLog.plannedSegments.results.map(r => ({ key: r.key, distanceM: r.distanceM ?? null,
          seconds: r.seconds ?? null, rpe: r.rpe ?? null })).sort((a, b) => a.key.localeCompare(b.key)),
      } } : {}),
      exercises: e.exerciseLog?.components.map(c => ({ kind: c.kind, rows: c.rows.map(r => ({
        distanceM: r.distanceM ?? null, durationSeconds: r.durationSeconds ?? null,
        repetitions: r.repetitions ?? null, sets: r.sets ?? null, recovery: r.recovery ?? null,
        setRecovery: r.setRecovery ?? null, loadKg: r.loadKg ?? null,
        contacts: r.contacts ?? null, side: r.side ?? null,
      })) })) ?? [],
    } : {}) })).sort((a,b) => a.id.localeCompare(b.id))
}

export function prepareExecutionReplan(input: {
  state: PlanBetaStateV3; entries: readonly JournalEntry[]; entryId: string; today: string; now: string;
  noFixedFutureCommitments: boolean; journalGuard: ExecutionReplanReceipt["journalGuard"];
}): ReplanPreparation {
  const parsed = planBetaStateV3Schema.safeParse(input.state)
  if (!parsed.success || !isValidIsoDate(input.today) || !Number.isFinite(Date.parse(input.now))) return { kind: "blocked", message: "현재 계획을 다시 불러와 주세요." }
  const state = parsed.data, startDate = state.intake.startDate
  const frame = state.activePlan.frame
  if (!("formationKind" in frame)) return { kind: "blocked", message: "이전 형식의 계획은 원본을 그대로 유지해요." }
  if (!startDate || state.activePlan.selectionActor !== "SELF") return { kind: "blocked", message: "시작 날짜와 계획 선택 권한을 먼저 확인해 주세요." }
  const entry = input.entries.find((e): e is PostSessionEntry => e.id === input.entryId && e.kind === "post-session")
  if (!entry || entry.date > input.today || !entry.plannedSessionLink) return { kind: "blocked", message: "실제로 남긴 훈련 기록이 필요해요." }
  const session = resolveCurrentPlannedSession(state, entry.plannedSessionLink)
  if (!session) return { kind: "blocked", message: "이 기록은 이전 계획에 연결되어 있어요. 현재 계획에서 남긴 기록을 선택해 주세요." }
  const conflict = input.entries.filter(e => e.kind === "post-session" && e.plannedSessionLink?.plannedSessionId === entry.plannedSessionLink!.plannedSessionId).length !== 1
  const review = reviewPlanExecution(entry, { kind: "matched", session, state, source: "ACTIVE" }, conflict)
  if (["SAFETY_REVIEW", "CONFLICT", "SOURCE_UNAVAILABLE"].includes(review.status)
    || state.progress.some(p => p.state === "PAIN_CHECKIN")) return { kind: "blocked", message: review.next }
  if (review.repetitionComparison?.kind === "unavailable") return { kind: "blocked", message: "반복 기록과 원래 처방의 연결을 먼저 확인해 주세요." }
  if (!entry.activityOutcome) return { kind: "blocked", message: "운동을 했는지 먼저 기록해 주세요. 빈 기록을 건너뛴 훈련으로 보지 않아요." }
  const protectedSlots = state.activePlan.sessions.filter(s => isoShift(startDate, s.day-1) <= input.today
    || state.progress.some(p => p.sessionDay === s.day && p.sessionSlot === s.slot)
    || input.entries.some(e => e.kind === "post-session" && e.plannedSessionLink
      && e.plannedSessionLink.plannedDate === isoShift(startDate, s.day-1) && e.plannedSessionLink.sessionSlot === s.slot))
    .map(s => ({ day: s.day, slot: s.slot }))
  const eligible = state.activePlan.sessions.filter(s => !protectedSlots.some(p => replanKey(p) === replanKey(s))
    && s.role !== "REST" && s.day <= Math.ceil("projectionLengthDays" in state.activePlan.frame
      ? state.activePlan.frame.projectionLengthDays ?? state.activePlan.frame.lengthDays : state.activePlan.frame.lengthDays))
    .sort((a,b) => a.day-b.day || a.slot.localeCompare(b.slot))
  const evidenceFingerprint = replanFingerprint(executionReplanEvidence(input.entries))
  const proposals: ExecutionReplanProposal[] = [], unavailable: Extract<ReplanPreparation, { kind: "ready" }>["unavailable"] = []
  const labels = { REDUCE: "운동 시간 줄이기", REPLACE: "주요 훈련을 저강도로", MOVE_LATER: "훈련을 뒤로 옮기기" }
  const reasons = {
    REDUCE: "기록한 수행을 확인하고, 앞으로 할 운동 시간을 원래 안내 범위의 짧은 쪽으로 골랐어요. 강도는 그대로예요.",
    REPLACE: "다음 주요 훈련 대신 이 계획에 있던 저강도 구성을 골랐어요. 원래의 주요 자극은 줄고, 놓친 훈련을 보충하지 않아요.",
    MOVE_LATER: "훈련 구성은 그대로 두고 뒤의 운동 날짜로 옮겨요. 원래 날짜는 쉬고, 이동한 날의 저강도 운동은 하지 않아요.",
  }
  for (const action of ["REDUCE", "REPLACE", "MOVE_LATER"] as const) {
    let chosen: ExecutionReplanProposal | null = null
    for (const source of eligible) {
      const targets = action === "REDUCE" ? [null] : state.activePlan.sessions
      for (const target of targets) {
        const receipt: ExecutionReplanReceipt = { version: 1, policy: EXECUTION_REPLAN_POLICY,
          trigger: "EXECUTION_REVIEW_CONFIRMED", action, source: { day: source.day, slot: source.slot },
          target: target ? { day: target.day, slot: target.slot } : null,
          baseStateFingerprint: replanFingerprint(state), baseCandidateId: state.activePlan.candidateId,
          baseSessions: structuredClone([...state.activePlan.sessions]), protectedSlots,
          startDate, today: input.today, sourceJournalId: entry.id, evidenceFingerprint,
          journalGuard: input.journalGuard, noFixedFutureCommitments: input.noFixedFutureCommitments, acceptedAt: input.now }
        const sessions = replayExecutionReplan(receipt)
        if (!sessions || sessions.some(s => s.day > Math.ceil("projectionLengthDays" in state.activePlan.frame
          ? state.activePlan.frame.projectionLengthDays ?? state.activePlan.frame.lengthDays : state.activePlan.frame.lengthDays)
          && replanFingerprint(s) !== replanFingerprint(state.activePlan.sessions.find(old => replanKey(old) === replanKey(s))))) continue
        const { explanationReceipt: _oldExplanation, activePlanEdit: _oldManualEdit, ...base } = state
        const activePlan = { ...state.activePlan, sessions }
        activePlan.candidateId = deriveCandidateId(state.activePlan.candidateId, {
          kind: activePlan.candidateKind, eventDistanceM: activePlan.eventDistanceM,
          selectedDetailedTemplateRef: activePlan.selectedDetailedTemplateRef, selectedEnergyIntent: activePlan.selectedEnergyIntent,
          sourceMode: activePlan.sourceMode, selectionAuthority: "SELF", frame, sessions,
        })
        const after = planBetaStateV3Schema.safeParse({ ...base, activePlan, executionReplan: receipt })
        if (!after.success) continue
        chosen = { id: replanFingerprint(after.data), action, title: labels[action], reason: reasons[action], before: state, after: after.data }
        break
      }
      if (chosen) break
    }
    if (chosen) proposals.push(chosen)
    else unavailable.push({ action, reason: action === "MOVE_LATER" && !input.noFixedFutureCommitments
      ? "옮길 날짜에 경기나 고정 일정이 없는지 확인해 주세요."
      : action === "REPLACE" ? "시간과 강도를 늘리지 않고 바꿀 저강도 구성이 없어요."
      : action === "REDUCE" ? "남은 훈련에 조정 가능한 시간 범위가 없어요."
      : "기존 훈련 간격과 오전·오후 구성을 지키며 옮길 자리가 없어요." })
  }
  return { kind: "ready", proposals, unavailable }
}
