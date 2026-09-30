import type { PostSessionEntry } from "./journal-schema"
import type { PlanSafetyJournalRead } from "./journal-store"
import type { readJournalOriginalPlan } from "./journal-original-plan"
import { plannedSessionLinkSchema } from "./planned-session-link"
import { describeExerciseRow, EXERCISE_KINDS } from "./exercise-log"
import { projectStructuredJournalObservation } from "./journal-observation"
import { comparePlannedRepetitions } from "./planned-repetition-evidence"
import { comparePlannedSegments } from "./planned-segment-evidence"

export type OriginalPlanLookup = ReturnType<typeof readJournalOriginalPlan>
export const EXECUTION_REVIEW_POLICY_VERSION = "descriptive-review-v2" as const
export type ExecutionReviewMetric = {
  readonly label: string
  readonly actual: string
  readonly planned?: string
}
export type ExecutionReview = {
  readonly policyVersion: typeof EXECUTION_REVIEW_POLICY_VERSION
  readonly id: string
  readonly date: string
  readonly slot: string
  readonly status: "SOURCE_UNAVAILABLE" | "CONFLICT" | "SAFETY_REVIEW" | "CHANGED" | "REPORTED"
  readonly title: string
  readonly summary: string
  readonly metrics: readonly ExecutionReviewMetric[]
  readonly facts: readonly string[]
  readonly unknowns: readonly string[]
  readonly explanation: string
  readonly next: string
  readonly actualExercises: readonly { readonly kind: string; readonly rows: readonly string[] }[]
  readonly awaitingDeviceData?: boolean
  readonly timingChange?: string
  readonly recordLabel?: string
  readonly repetitionComparison?: import("./planned-repetition-evidence").RepetitionComparison
}

const outcomeText = {
  COMPLETED: "운동을 마쳤다고 기록했어요.", PARTIAL: "일부만 했다고 기록했어요.",
  LIGHT_ACTIVITY: "가볍게 운동했다고 기록했어요.", RESTED: "쉬었다고 기록했어요.", SKIPPED: "이번 훈련을 건너뛰었다고 기록했어요.",
} as const

/** A factual projection only. Never read memo, title, exercise names or import payloads. */
export function reviewPlanExecution(entry: PostSessionEntry, original: OriginalPlanLookup, conflict = false): ExecutionReview {
  const base = { policyVersion: EXECUTION_REVIEW_POLICY_VERSION, id: entry.id, date: entry.date, slot: entry.activitySlot === "PM" ? "오후" : entry.activitySlot === "AM" ? "오전" : "시간대 미기록",
    ...(entry.objectiveDataState === "WAITING" ? { awaitingDeviceData: true } : {}) }
  const pain = entry.painCheckStatus === "SIGNAL_REPORTED" || Object.values(entry.painParts ?? {}).some(value => value > 0)
  const unavailable = (): ExecutionReview => ({ ...base, status: pain ? "SAFETY_REVIEW" : "SOURCE_UNAVAILABLE", title: pain ? "몸 상태 확인이 먼저예요" : "원래 계획을 확인해 주세요", facts: [], metrics: [],
    summary: pain ? "이 기록에 통증 표시가 있어요. 다음 훈련 전에 몸 상태를 확인해 주세요." : "연결된 계획을 읽지 못했어요. 다른 계획으로 대신 비교하지 않아요.",
    unknowns: ["이 기록과 정확히 연결된 계획 원본을 확인하지 못했어요."], explanation: "오늘의 계획이나 비슷한 날짜의 훈련을 대신 비교하지 않아요.",
    next: pain ? "통증 기록이 있어요. 원본 조회와 별개로 다음 훈련 전에 몸 상태를 확인해 주세요." : "일지에서 연결된 계획을 다시 열어 주세요. 기록과 계획은 그대로 보관돼요.", actualExercises: [] })
  const link = plannedSessionLinkSchema.safeParse(entry.plannedSessionLink)
  if (!link.success || link.data.plannedDate !== entry.date) return unavailable()
  if (conflict || entry.objectiveDataState === "CONFLICT") return { ...base, status: pain ? "SAFETY_REVIEW" : "CONFLICT", title: pain ? "몸 상태 확인이 먼저예요" : "겹친 기록을 확인해 주세요", facts: [], metrics: [],
    summary: pain ? "이 기록에 통증 표시가 있어요. 겹친 기록 확인과 별개로 몸 상태를 확인해 주세요." : "같은 훈련에 연결된 기록이 겹치거나 값이 서로 달라요. 임의로 합치지 않았어요.",
    unknowns: ["같은 계획 훈련에 여러 기록이 연결됐거나 자료가 서로 충돌해요."], explanation: "두 기록을 더하거나 하나를 임의로 선택하면 운동량을 잘못 판단할 수 있어요.",
    next: pain ? "통증 기록이 있어요. 몸 상태를 확인하고 겹친 일지도 확인해 주세요." : "해당 날짜의 일지에서 어느 기록이 맞는지 확인해 주세요. 지금은 일정 변경의 근거로 쓰지 않아요.", actualExercises: [] }
  if (!("session" in original) || !original.session || original.sourceVerificationPending) return unavailable()
  const facts: string[] = []
  const unknowns: string[] = []
  const metrics: ExecutionReviewMetric[] = []
  const timingChange = (entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== link.data.sessionSlot
    ? `계획은 ${link.data.sessionSlot === "AM" ? "오전" : "오후"}, 실제 운동은 ${entry.activitySlot === "AM" ? "오전" : "오후"}에 했다고 기록했어요.` : undefined
  if (timingChange) facts.push(timingChange)
  if (entry.activityOutcome) facts.push(outcomeText[entry.activityOutcome])
  else unknowns.push("완료·일부 수행·휴식 중 어떤 결과인지 기록되지 않았어요.")
  const didNotPerform = entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED"
  const changed = entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY"
    || (didNotPerform && original.session.role !== "REST")
    || (original.session.role === "REST" && entry.activityOutcome === "COMPLETED")
  if (entry.planExecutionRelation === "NOT_APPLICABLE") unknowns.push("계획과 대응하지 않는 운동으로 표시되어 강도 준수 여부를 비교하지 않아요.")
  if (entry.planExecutionRelation === "AS_PLANNED" || entry.planExecutionRelation === "MODIFIED") {
    unknowns.push("완료 표시와 시간대만으로 실제 반복·거리·회복이 계획과 같았는지는 알 수 없어요.")
  }
  if (!didNotPerform) {
    const explicit = (field: string) => entry.fieldProvenance?.[field]?.provenance === "EXPLICIT"
    const measured = projectStructuredJournalObservation({ sourceKind: "SESSION_RESULT_RECORD", sourceId: entry.id,
      loggedOn: entry.date, observedAt: entry.savedAt, distanceKm: explicit("distanceKm") ? entry.distanceKm : "",
      durationMin: explicit("durationMin") ? entry.durationMin : "", avgPace: explicit("avgPace") ? entry.avgPace : "", rpe: 0 })
    if (measured.distanceKm !== null) {
      facts.push(`직접 기록한 거리: ${measured.distanceKm}km.`)
      metrics.push({ label: "기록한 거리", actual: `${measured.distanceKm}km` })
    }
    if (measured.durationMin !== null) {
      facts.push(`직접 기록한 시간: ${measured.durationMin}분.`)
      metrics.push({ label: "기록한 시간", actual: `${measured.durationMin}분` })
    }
    if (measured.secondsPerKm !== null) {
      const pace = `${Math.floor(measured.secondsPerKm / 60)}분 ${measured.secondsPerKm % 60}초/km`
      facts.push(`직접 기록한 평균 페이스: ${pace}.`)
      metrics.push({ label: "기록한 평균 페이스", actual: pace })
    }
  }
  const p = original.session.prescription
  if (!didNotPerform && Number.isInteger(entry.rpe) && entry.rpe >= 1 && entry.rpe <= 10
    && entry.rpeBand === undefined && entry.fieldProvenance?.rpe?.provenance === "EXPLICIT") {
    facts.push(`직접 기록한 힘든 정도는 RPE ${entry.rpe}예요.`)
    const planned = p.kind === "RPE_TIME_RANGE" && entry.planExecutionRelation !== "NOT_APPLICABLE"
      ? `${p.rpe.minimum}~${p.rpe.maximum}` : undefined
    metrics.unshift({ label: "힘든 정도 · RPE", actual: String(entry.rpe), ...(planned ? { planned } : {}) })
    if (planned !== undefined) {
      facts.push(`계획한 강도: RPE ${planned}.`)
      unknowns.push("같은 운동을 마쳤는지 확인되지 않아, RPE 준수 여부를 판정하지 않아요.")
    } else if (p.kind !== "RPE_TIME_RANGE") unknowns.push("이 계획에는 비교할 RPE 범위가 없어, 느낀 강도로 페이스 준수 여부를 판단하지 않아요.")
  } else if (!didNotPerform) unknowns.push("직접 입력한 정확한 RPE가 없어요. 빈 값을 0으로 보지 않아요.")
  const actualExercises = didNotPerform ? [] : (entry.exerciseLog?.components ?? []).map(component => ({
    kind: EXERCISE_KINDS[component.kind], rows: component.rows.map(describeExerciseRow),
  }))
  const repetitionComparison = !didNotPerform && entry.planExecutionRelation !== "NOT_APPLICABLE" && entry.exerciseLog?.plannedRepetitions
    ? comparePlannedRepetitions(entry.exerciseLog.plannedRepetitions, link.data, original.session)
    : !didNotPerform && entry.planExecutionRelation !== "NOT_APPLICABLE" && entry.exerciseLog?.plannedSegments
      ? comparePlannedSegments(entry.exerciseLog.plannedSegments, link.data, original.session) : undefined
  if (repetitionComparison) {
    facts.push(...repetitionComparison.facts)
    unknowns.push(...repetitionComparison.unknowns)
  } else if (!didNotPerform) unknowns.push("실제 운동의 각 구간과 계획 구간의 대응이 확인되지 않아 거리·반복·회복의 일치 여부는 아직 판단하지 않아요.")
  if (entry.objectiveDataState === "WAITING") unknowns.push("워치 등 추가 운동 자료를 기다리는 중이에요.")
  if (original.source === "ARCHIVED") facts.push("현재 계획이 아니라, 이 기록에 연결된 당시 계획과 비교했어요.")
  const outcomeTitle = entry.activityOutcome === "PARTIAL" ? "일부만 한 훈련"
    : entry.activityOutcome === "RESTED" ? "쉬었던 날의 훈련"
      : entry.activityOutcome === "SKIPPED" ? "건너뛴 훈련"
        : entry.activityOutcome === "LIGHT_ACTIVITY" ? "가볍게 운동한 날"
          : "계획과 실제 기록"
  const changedExplanation = entry.activityOutcome === "PARTIAL"
    ? "일부만 했다는 기록은 남았지만, 어느 반복이나 구간을 마쳤는지는 별도로 확인해야 해요. 남은 반복 수를 추측해서 다음 운동에 더하지 않아요."
    : entry.activityOutcome === "LIGHT_ACTIVITY"
      ? "가볍게 했다는 표현만으로 실제 운동량이나 에너지 자극을 계산하지 않아요. 원래 계획의 주요 훈련을 수행한 것으로 자동 집계하지도 않아요."
      : "운동 구성이나 느낀 강도가 달라지면 계획한 자극과 실제 경험이 다를 수 있어요. 이 기록만으로 회복 시간이나 체력 변화를 단정하지 않아요."
  return { ...base, status: pain ? "SAFETY_REVIEW" : changed || repetitionComparison?.changed ? "CHANGED" : "REPORTED",
    title: pain ? "몸 상태 확인이 먼저예요" : outcomeTitle,
    summary: pain ? "이 기록에 통증 표시가 있어요. 다음 훈련 전에 몸 상태를 확인해 주세요."
      : entry.activityOutcome ? outcomeText[entry.activityOutcome] : "연결된 계획과 직접 남긴 기록을 나란히 확인해요.",
    facts, unknowns, actualExercises, metrics, ...(timingChange ? { timingChange } : {}),
    ...(!pain && repetitionComparison ? { repetitionComparison } : {}),
    explanation: pain ? "통증 기록이 있어요. 수행 비교 결과가 괜찮아 보여도 안전 확인을 대신하지 않아요."
      : didNotPerform ? "이번 훈련의 자극을 받았다고 계산하지 않아요. 그렇다고 곧바로 체력이 떨어졌다는 뜻도 아니에요."
        : repetitionComparison?.kind === "compared" ? repetitionComparison.interpretation
          : changed ? changedExplanation
          : "완료 표시와 RPE만으로 거리·반복·회복까지 계획과 같았다고 판단하지 않아요. 계획한 자극과 실제 효과는 별개예요.",
    next: pain ? "일지에서 몸 상태를 확인해 주세요. 이 화면은 안전 제한을 해제하지 않아요."
      : changed ? "남은 일정부터 확인해 주세요. 빠진 운동을 자동으로 추가하지 않아요."
        : "더 남길 내용이 없다면 여기서 마쳐도 돼요.",
  }
}

export function collectExecutionReviews(read: PlanSafetyJournalRead, resolve: (entry: PostSessionEntry) => OriginalPlanLookup, today: string,
  options: { readonly limit?: number; readonly journalId?: string } = {}): readonly ExecutionReview[] {
  if (read.status !== "complete") return []
  const entries = read.entries.filter((entry): entry is PostSessionEntry => entry.kind === "post-session" && !!entry.plannedSessionLink && entry.date <= today)
  const counts = new Map<string, number>()
  const occurrenceIds = new Map<string, string[]>()
  for (const entry of entries) {
    const id = entry.plannedSessionLink!.plannedSessionId
    counts.set(id, (counts.get(id) ?? 0) + 1)
    occurrenceIds.set(id, [...(occurrenceIds.get(id) ?? []), entry.id])
  }
  for (const ids of occurrenceIds.values()) ids.sort()
  const slotOrder = (entry: PostSessionEntry) => entry.activitySlot === "PM" ? 2 : entry.activitySlot === "AM" ? 1 : 0
  // Memo edits also update savedAt; they must not reorder the coaching feed.
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || slotOrder(b) - slotOrder(a) || a.id.localeCompare(b.id))
    .filter(entry => options.journalId === undefined || entry.id === options.journalId)
    .slice(0, options.limit)
    .map(entry => {
      let original: OriginalPlanLookup
      try { original = resolve(entry) } catch { original = { kind: "unavailable" } }
      const occurrence = entry.plannedSessionLink!.plannedSessionId
      const duplicate = (counts.get(occurrence) ?? 0) > 1
      const review = reviewPlanExecution(entry, original, duplicate)
      return duplicate ? { ...review, recordLabel: `겹친 기록 ${occurrenceIds.get(occurrence)!.indexOf(entry.id) + 1}/${counts.get(occurrence)}` } : review
    })
}
