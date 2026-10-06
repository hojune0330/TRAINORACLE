import { oracleContentTopic, type OracleDestination, type OracleTopicKind } from "./oracle-content-catalog"
import type { AthleteRecord } from "./athlete-records"
import { isValidIsoDate } from "./dates"
import { ORACLE_AXES, ORACLE_QUESTIONS, scoreOracleResponses, describeOracleAxis, type OracleAxisId } from "./oracle-profile-v2"
import { oracleProfileRevisionSchema, type OracleProfileRevision } from "./oracle-profile-snapshot"
import { READING_EVENTS, readPersonalRecord } from "./record-reading-oracle"
import { z } from "zod"
import { parseAthleteRecord } from "./athlete-records"
import type { ProjectedFileObservation } from "./import/file-analysis"
import { ENERGY_SYSTEM_META } from "./energy-system-taxonomy"

export const ORACLE_CONTENT_READER_VERSION = "ORACLE_CONTENT_READER_V2_2" as const

/** Adapters must report a failed/loading read as UNAVAILABLE, never MISSING. */
export type OracleReaderSource<T> =
  | { readonly state: "READY"; readonly sourceVersion: string; readonly data: T; readonly coverage?: "COMPLETE" | "PARTIAL" }
  | { readonly state: "MISSING" | "UNAVAILABLE" | "REVOKED" }

export type OracleReadingStatus = "SUFFICIENT" | "PARTIAL" | "MISSING" | "UNAVAILABLE" | "REVOKED"
export type OracleReadingUnit = "count" | "days" | "m" | "km" | "s" | "min" | "s/200m" | "s/400m" | "s/km" | "index" | "%" | "RPE" | "bpm" | "reps" | "sets" | "kg" | "date" | "category" | "answer" | "currency"
export type OracleReadingMetric = `M${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20"}` | "DIRECT"
export type OracleTrainingPurpose = "BASE" | "REC" | "LT" | "VO2" | "GLY" | "SPEED" | "ATP_PC" | "MIX" | "OTHER"
export type OracleMovementForm = "CONTINUOUS" | "INTERVAL" | "BOTH"
export type OracleActivity = "RUN" | "WEIGHTS" | "JUMPS" | "CYCLING" | "SUPPLEMENTARY" | "CROSS_TRAINING" | "MIXED" | "UNKNOWN"
export type OracleGoal = "RECORD" | "FINISH" | "EXPERIENCE" | "RANK" | "QUALIFY" | "REFRESH" | "ROUTINE" | "LEARN"
export type OraclePlace = "TRACK" | "ROAD" | "TRAIL" | "HILL" | "GYM" | "INDOOR"
export type OracleEquipment = "NONE" | "WEIGHTS" | "BIKE" | "TREADMILL"
export type OracleReaderProvenance = "EXPLICIT" | "CONFIRMED_FILE" | "VERIFIED_RECORD" | "SELF_REPORTED" | "ORIGINAL_PLAN" | "REVIEWED_CATALOG" | "DEVICE_ESTIMATE"
export interface OraclePeriod { readonly startDate: string; readonly endDate: string }
export interface OracleReaderRef {
  readonly source: string
  readonly sourceVersion: string
  readonly itemId?: string
  readonly date?: string
  readonly provenance: OracleReaderProvenance
}
export interface OracleReadingFact {
  readonly id: string
  readonly label: string
  readonly value: number | string
  readonly unit: OracleReadingUnit
  readonly metric: OracleReadingMetric
  readonly sourceRefs: readonly OracleReaderRef[]
  readonly owner: "SELF" | "FRIEND" | "COMPARISON"
  readonly denominator?: number
  readonly period?: OraclePeriod
}

export interface OracleReaderSegment {
  readonly id: string
  readonly distanceM: number
  readonly seconds: number
  readonly recoverySeconds?: number
  readonly set?: number
}
export interface OracleReaderStep {
  readonly id: string
  readonly phase: "warmup" | "main" | "cooldown"
  readonly kind: "WORK" | "BUILDUP" | "PREPARATION" | "RECOVERY"
  readonly distanceM?: number
  readonly seconds?: number
  readonly rpe?: number
}
/** Only individually eligible fields belong here. No journal entry or memo payload. */
export interface OracleReaderSession {
  readonly id: string
  readonly date: string
  readonly provenance: "EXPLICIT" | "CONFIRMED_FILE"
  readonly activity: OracleActivity
  readonly slot?: "AM" | "PM"
  readonly distanceKm?: number
  readonly durationMinutes?: number
  readonly purpose?: OracleTrainingPurpose
  readonly form?: Exclude<OracleMovementForm, "BOTH">
  readonly rpe?: number
  readonly heartRateBpm?: number
  readonly sets?: number
  readonly reps?: number
  readonly weightKg?: number
  readonly segments?: readonly OracleReaderSegment[]
  readonly segmentsComplete?: boolean
  readonly includesFinalRecovery?: boolean
  readonly components?: readonly OracleReaderExerciseComponent[]
  readonly steps?: readonly OracleReaderStep[]
}
export interface OracleReaderExerciseComponent {
  readonly id: string
  readonly activity: OracleActivity
  readonly rows: readonly {
    readonly id: string; readonly distanceM?: number; readonly durationSeconds?: number
    readonly repetitions?: number; readonly sets?: number; readonly loadKg?: number; readonly contacts?: number
    readonly recoverySeconds?: number; readonly setRecoverySeconds?: number
  }[]
}
export interface OracleReaderTraining {
  readonly period: OraclePeriod
  readonly coverage: "COMPLETE" | "PARTIAL"
  readonly sessions: readonly OracleReaderSession[]
}
export interface OracleReaderAnswers {
  readonly motivations?: readonly OracleGoal[]
  readonly movementForm?: OracleMovementForm
  readonly company?: "ALONE" | "TOGETHER" | "BOTH"
  readonly conversation?: "QUIET" | "TALK" | "EITHER"
  readonly familiarEnjoyment?: "YES" | "NO" | "VARIES" | "UNKNOWN"
  readonly learningInterests?: readonly ("RUN" | "WEIGHTS" | "JUMPS" | "CYCLING" | "SUPPLEMENTARY" | "METHODS" | "RACES")[]
  readonly supplementaryExperience?: "YES" | "NO" | "UNKNOWN"
  readonly supplementaryInterest?: "YES" | "NO" | "UNKNOWN"
  readonly raceGoals?: readonly OracleGoal[]
  readonly raceOutcomes?: readonly OracleGoal[]
  readonly todayGoals?: readonly OracleGoal[]
  readonly togetherPhases?: readonly ("WARMUP" | "MAIN" | "RECOVERY" | "COOLDOWN")[]
  readonly context?: "SEASON" | "TEAM" | "STUDY" | "WORK" | "OTHER" | "UNKNOWN"
}
export interface OracleReaderConditions {
  readonly availableMinutes?: number
  readonly places?: readonly OraclePlace[]
  readonly equipment?: readonly OracleEquipment[]
  /** Minutes since midnight on the explicitly selected local date, not location data. */
  readonly meetingWindows?: readonly { readonly date: string; readonly startMinute: number; readonly endMinute: number }[]
  readonly races?: readonly {
    readonly recordId: string
    readonly course?: "TRACK" | "ROAD" | "TRAIL" | "HILLY"
    readonly weather?: "DRY" | "RAIN" | "WIND" | "HEAT" | "COLD"
    readonly round?: "HEAT" | "SEMIFINAL" | "FINAL" | "TIMED"
    readonly goal?: OracleGoal
  }[]
  readonly events?: readonly {
    readonly id: string; readonly date: string; readonly travelMinutes?: number
    readonly cost?: { readonly amount: number; readonly currency: "KRW" | "USD" | "EUR" | "JPY" | "GBP" }
  }[]
}
export interface OracleReaderPlanActual {
  readonly id: string
  readonly date: string
  readonly sessionId: string
  readonly originalPlanVersion: string
  readonly completion: "COMPLETED" | "PARTIAL" | "CHANGED" | "UNKNOWN"
  readonly plannedDistanceKm?: number
  readonly plannedDurationMinutes?: number
  readonly plannedDurationMinutesRange?: { readonly min: number; readonly max: number }
  /** Required to compare whole-session time with a prescription's time scope. */
  readonly durationComparison?: "MATCHED_SCOPE"
  readonly plannedRpe?: { readonly min: number; readonly max: number }
  /** Original targets linked to actual segment IDs; never recomputed from a new PB. */
  readonly segmentTargets?: readonly { readonly segmentId: string; readonly distanceM: number; readonly minSeconds: number; readonly maxSeconds: number }[]
  /** A stored point target is NOT an invented tolerance range. */
  readonly pointTargets?: readonly { readonly segmentId: string; readonly distanceM: number; readonly seconds: number }[]
  readonly stepTargets?: readonly { readonly stepId: string; readonly distanceM?: number; readonly minSeconds: number; readonly maxSeconds: number }[]
}
export interface OracleReaderMethod {
  readonly id: string
  readonly purpose: OracleTrainingPurpose
  readonly form?: Exclude<OracleMovementForm, "BOTH">
  readonly requiredMinutes?: number
  /** Includes preparation, work, recovery and cooldown; never a midpoint target. */
  readonly requiredMinutesRange?: { readonly min: number; readonly max: number }
  readonly places?: readonly OraclePlace[]
  readonly equipment?: readonly OracleEquipment[]
  readonly catalog?: {
    readonly version: string
    readonly fingerprint: string
    readonly calculationFingerprint: string
    readonly requirements: readonly OracleCatalogRequirement[]
    readonly modalities: readonly ("RUN" | "WALK" | "BIKE" | "ELLIPTICAL" | "DEEP_WATER_RUN" | "SWIM")[]
    readonly terrains: readonly ("FLAT" | "INDOOR" | "POOL" | "UPHILL" | "ROLLING")[]
  }
}
export const ORACLE_CATALOG_REQUIREMENTS = ["ACCELERATION_AND_DECELERATION_SPACE", "HIGH_INTENSITY_REPETITION_EXPERIENCE",
  "RECENT_LONG_RUN_BASELINE", "RECENT_THRESHOLD_VOLUME", "COMPOUND_TRAINING_EXPERIENCE", "BIKE_AVAILABLE",
  "ELLIPTICAL_AVAILABLE", "WATER_SAFETY_AND_EQUIPMENT", "SWIMMING_ABILITY_AND_WATER_SAFETY", "HILL_SURFACE_GRADE_RETURN", "CONNECTED_HILL_FLAT_ROUTE"] as const
export type OracleCatalogRequirement = typeof ORACLE_CATALOG_REQUIREMENTS[number]
export interface OracleReaderLaps {
  readonly recordId: string
  readonly date: string
  readonly complete: boolean
  readonly segments: readonly OracleReaderSegment[]
}
/** Activity observations are not linked race records. Preserve native time semantics and gaps. */
export interface OracleReaderFileLaps extends Pick<ProjectedFileObservation,
  "journalEntryId" | "sourceObservationKey" | "contentRevisionFingerprint" | "date" | "sport" | "laps" | "policyVersion"> {
  readonly kind: "FILE_ACTIVITY"
}
/** This is a passed, already authorized subset, NOT an access-control implementation.
 * The caller rechecks account, expiry, deletion, blocking and consent on every read.
 * Comparison permission never authorizes sharing. No friend data is accepted elsewhere.
 */
export interface OracleReaderFriend {
  readonly permission: "COMPARISON_ALLOWED"
  readonly records?: OracleReaderSource<readonly AthleteRecord[]>
  readonly profile?: OracleReaderSource<OracleProfileRevision>
  readonly answers?: OracleReaderSource<OracleReaderAnswers>
  readonly conditions?: OracleReaderSource<OracleReaderConditions>
  readonly training?: OracleReaderSource<OracleReaderTraining>
}
export interface OracleContentReaderInput {
  readonly today: string
  readonly profile?: OracleReaderSource<OracleProfileRevision>
  readonly previousProfile?: OracleReaderSource<OracleProfileRevision>
  readonly answers?: OracleReaderSource<OracleReaderAnswers>
  readonly records?: OracleReaderSource<readonly AthleteRecord[]>
  readonly goal?: OracleReaderSource<{ readonly eventDistanceM: number; readonly performanceSeconds: number }>
  readonly laps?: OracleReaderSource<OracleReaderLaps | OracleReaderFileLaps>
  readonly device?: OracleReaderSource<{ readonly eventDistanceM: number; readonly performanceSeconds: number; readonly date: string; readonly modelVersion: string }>
  readonly training?: OracleReaderSource<OracleReaderTraining>
  readonly previousTraining?: OracleReaderSource<OracleReaderTraining>
  readonly planActual?: OracleReaderSource<readonly OracleReaderPlanActual[]>
  readonly conditions?: OracleReaderSource<OracleReaderConditions>
  readonly method?: OracleReaderSource<OracleReaderMethod>
  readonly friend?: OracleReaderSource<OracleReaderFriend>
  readonly share?: OracleReaderSource<{ readonly permission: "EXTERNAL_SHARE_ALLOWED"; readonly selectedFields: readonly ("ANSWERS" | "RACE_RECORDS" | "TRAINING")[] }>
}
export interface OracleContentReading {
  readonly topicId: string
  readonly title: string
  readonly kind: OracleTopicKind
  readonly status: OracleReadingStatus
  readonly personalized: boolean
  readonly readerVersion: typeof ORACLE_CONTENT_READER_VERSION
  readonly contentVersion: string
  readonly sourceVersions: Readonly<Record<string, string>>
  readonly inputStates: Readonly<Record<string, OracleReadingStatus>>
  readonly facts: readonly OracleReadingFact[]
  readonly paragraphs: readonly string[]
  readonly limitations: readonly string[]
  readonly missingInputs: readonly string[]
  readonly nextAction: OracleDestination
}

const positive = z.number().finite().positive()
const nonnegative = z.number().finite().nonnegative()
const opaque = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:@/+-]+$/u)
const dateSchema = z.string().refine(isValidIsoDate)
const periodSchema = z.object({ startDate: dateSchema, endDate: dateSchema })
  .refine(p => p.startDate <= p.endDate)
const goalSchema = z.enum(["RECORD", "FINISH", "EXPERIENCE", "RANK", "QUALIFY", "REFRESH", "ROUTINE", "LEARN"])
const activitySchema = z.enum(["RUN", "WEIGHTS", "JUMPS", "CYCLING", "SUPPLEMENTARY", "CROSS_TRAINING", "MIXED", "UNKNOWN"])
const placeSchema = z.enum(["TRACK", "ROAD", "TRAIL", "HILL", "GYM", "INDOOR"])
const equipmentSchema = z.enum(["NONE", "WEIGHTS", "BIKE", "TREADMILL"])
const purposeSchema = z.enum(["BASE", "REC", "LT", "VO2", "GLY", "SPEED", "ATP_PC", "MIX", "OTHER"])
const formSchema = z.enum(["CONTINUOUS", "INTERVAL"])
const segmentSchema = z.object({
  id: opaque, distanceM: positive, seconds: positive, recoverySeconds: nonnegative.optional(),
  set: z.number().int().positive().optional(),
})
const sessionSchema = z.object({
  id: opaque, date: dateSchema, provenance: z.enum(["EXPLICIT", "CONFIRMED_FILE"]), activity: activitySchema,
  slot: z.enum(["AM", "PM"]).optional(), distanceKm: nonnegative.optional(), durationMinutes: positive.optional(),
  purpose: purposeSchema.optional(), form: formSchema.optional(), rpe: z.number().finite().min(0).max(10).optional(),
  heartRateBpm: positive.optional(), sets: z.number().int().nonnegative().optional(),
  reps: z.number().int().nonnegative().optional(), weightKg: nonnegative.optional(),
  segments: z.array(segmentSchema).optional(), segmentsComplete: z.boolean().optional(), includesFinalRecovery: z.boolean().optional(),
  components: z.array(z.object({ id: opaque, activity: activitySchema, rows: z.array(z.object({ id: opaque,
    distanceM: positive.optional(), durationSeconds: positive.optional(), repetitions: z.number().int().positive().optional(),
    sets: z.number().int().positive().optional(), loadKg: nonnegative.optional(), contacts: z.number().int().positive().optional(),
    recoverySeconds: nonnegative.optional(), setRecoverySeconds: nonnegative.optional(),
  })) })).optional(),
  steps: z.array(z.object({ id: opaque, phase: z.enum(["warmup", "main", "cooldown"]), kind: z.enum(["WORK", "BUILDUP", "PREPARATION", "RECOVERY"]),
    distanceM: positive.optional(), seconds: nonnegative.optional(), rpe: z.number().int().min(1).max(10).optional(),
  }).refine(s => s.seconds !== 0 || s.kind === "RECOVERY")).optional(),
})
const answersSchema = z.object({
  motivations: z.array(goalSchema).optional(), movementForm: z.enum(["CONTINUOUS", "INTERVAL", "BOTH"]).optional(),
  company: z.enum(["ALONE", "TOGETHER", "BOTH"]).optional(), conversation: z.enum(["QUIET", "TALK", "EITHER"]).optional(),
  familiarEnjoyment: z.enum(["YES", "NO", "VARIES", "UNKNOWN"]).optional(),
  learningInterests: z.array(z.enum(["RUN", "WEIGHTS", "JUMPS", "CYCLING", "SUPPLEMENTARY", "METHODS", "RACES"])).optional(),
  supplementaryExperience: z.enum(["YES", "NO", "UNKNOWN"]).optional(), supplementaryInterest: z.enum(["YES", "NO", "UNKNOWN"]).optional(),
  raceGoals: z.array(goalSchema).optional(), raceOutcomes: z.array(goalSchema).optional(), todayGoals: z.array(goalSchema).optional(),
  togetherPhases: z.array(z.enum(["WARMUP", "MAIN", "RECOVERY", "COOLDOWN"])).optional(),
  context: z.enum(["SEASON", "TEAM", "STUDY", "WORK", "OTHER", "UNKNOWN"]).optional(),
})
const conditionsSchema = z.object({
  availableMinutes: nonnegative.optional(), places: z.array(placeSchema).optional(), equipment: z.array(equipmentSchema).optional(),
  meetingWindows: z.array(z.object({ date: dateSchema, startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) })
    .refine(w => w.startMinute < w.endMinute)).optional(),
  races: z.array(z.object({ recordId: opaque, course: z.enum(["TRACK", "ROAD", "TRAIL", "HILLY"]).optional(),
    weather: z.enum(["DRY", "RAIN", "WIND", "HEAT", "COLD"]).optional(),
    round: z.enum(["HEAT", "SEMIFINAL", "FINAL", "TIMED"]).optional(), goal: goalSchema.optional() })).optional(),
  events: z.array(z.object({ id: opaque, date: dateSchema, travelMinutes: nonnegative.optional(),
    cost: z.object({ amount: nonnegative, currency: z.enum(["KRW", "USD", "EUR", "JPY", "GBP"]) }).optional() })).optional(),
}).refine(value => new Set(value.races?.map(r => r.recordId) ?? []).size === (value.races?.length ?? 0)
  && new Set(value.events?.map(e => e.id) ?? []).size === (value.events?.length ?? 0), "Conflicting context identities")
const planSchema = z.object({
  id: opaque, date: dateSchema, sessionId: opaque, originalPlanVersion: opaque,
  completion: z.enum(["COMPLETED", "PARTIAL", "CHANGED", "UNKNOWN"]),
  plannedDistanceKm: nonnegative.optional(), plannedDurationMinutes: positive.optional(),
  plannedDurationMinutesRange: z.object({ min: positive, max: positive }).refine(r => r.min <= r.max).optional(),
  durationComparison: z.literal("MATCHED_SCOPE").optional(),
  plannedRpe: z.object({ min: z.number().min(0).max(10), max: z.number().min(0).max(10) }).refine(r => r.min <= r.max).optional(),
  segmentTargets: z.array(z.object({ segmentId: opaque, distanceM: positive, minSeconds: positive, maxSeconds: positive })
    .refine(t => t.minSeconds <= t.maxSeconds)).optional(),
  pointTargets: z.array(z.object({ segmentId: opaque, distanceM: positive, seconds: positive })).optional(),
  stepTargets: z.array(z.object({ stepId: opaque, distanceM: positive.optional(), minSeconds: nonnegative, maxSeconds: nonnegative })
    .refine(s => s.minSeconds <= s.maxSeconds)).optional(),
})
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const methodSchema = z.object({ id: opaque, purpose: purposeSchema, form: formSchema.optional(), requiredMinutes: nonnegative.optional(),
  requiredMinutesRange: z.object({ min: nonnegative, max: nonnegative }).refine(v => v.min <= v.max).optional(),
  places: z.array(placeSchema).optional(), equipment: z.array(equipmentSchema).optional(),
  catalog: z.object({ version: opaque, fingerprint: fingerprintSchema, calculationFingerprint: fingerprintSchema,
    requirements: z.array(z.enum(ORACLE_CATALOG_REQUIREMENTS)), modalities: z.array(z.enum(["RUN", "WALK", "BIKE", "ELLIPTICAL", "DEEP_WATER_RUN", "SWIM"])),
    terrains: z.array(z.enum(["FLAT", "INDOOR", "POOL", "UPHILL", "ROLLING"])),
  }).optional(),
})
const fileLapsSchema = z.object({ kind: z.literal("FILE_ACTIVITY"), journalEntryId: opaque, sourceObservationKey: fingerprintSchema,
  contentRevisionFingerprint: fingerprintSchema, date: dateSchema, sport: z.enum(["RUNNING", "WALKING", "CYCLING", "OTHER", "UNKNOWN"]),
  policyVersion: z.literal("FILE_ANALYSIS_V1"), laps: z.array(z.object({ sourceIndex: z.number().int().nonnegative(),
    distanceMeters: nonnegative.nullable(), durationSeconds: nonnegative.nullable(),
    durationMeaning: z.enum(["TIMER", "MOVING", "ELAPSED", "SOURCE_DEFINED", "UNKNOWN"]), kind: z.enum(["WORK", "RECOVERY", "UNKNOWN"]),
  })).max(1000).refine(laps => laps.every((lap, index) => lap.sourceIndex === index)),
})

const labels: Readonly<Record<string, string>> = {
  RECORD: "기록 도전", FINISH: "완주", EXPERIENCE: "경험", RANK: "순위", QUALIFY: "예선 통과", REFRESH: "기분 전환", ROUTINE: "루틴", LEARN: "배움",
  CONTINUOUS: "이어 달리기", INTERVAL: "나눠 달리기", BOTH: "둘 다", ALONE: "혼자", TOGETHER: "함께", QUIET: "조용히", TALK: "대화", EITHER: "어느 쪽도",
  YES: "있음", NO: "없음", VARIES: "상황에 따라 다름", UNKNOWN: "아직 모름", INEXPERIENCED: "경험 없음", SKIPPED: "건너뜀",
  RUN: "달리기", WEIGHTS: "웨이트", JUMPS: "점프", CYCLING: "자전거", SUPPLEMENTARY: "보조 운동", METHODS: "훈련법", RACES: "대회",
  CROSS_TRAINING: "교차 운동 · 세부 종목 미확인", MIXED: "여러 운동 구성",
  TRACK: "트랙", ROAD: "도로", TRAIL: "트레일", HILL: "언덕", HILLY: "기복 코스", GYM: "체육관", INDOOR: "실내", NONE: "장비 없음", BIKE: "자전거", TREADMILL: "트레드밀",
  WARMUP: "준비", MAIN: "본운동", RECOVERY: "회복", COOLDOWN: "정리", SEASON: "시즌", TEAM: "팀", STUDY: "학업", WORK: "일", OTHER: "기타",
  DRY: "건조", RAIN: "비", WIND: "바람", HEAT: "더위", COLD: "추위",
  COMPLETED: "완료 표시", PARTIAL: "부분 표시", CHANGED: "변경 표시", AM: "오전", PM: "오후",
}
function label(value: string): string { return labels[value] ?? value }
const raceRoundLabels = { HEAT: "예선", SEMIFINAL: "준결승", FINAL: "결승", TIMED: "기록 경기" } as const
const purposeMeta = { BASE: ENERGY_SYSTEM_META.BASE, REC: ENERGY_SYSTEM_META.RECOVERY, LT: ENERGY_SYSTEM_META.LT,
  VO2: ENERGY_SYSTEM_META.VO2, GLY: ENERGY_SYSTEM_META.GLY, ATP_PC: ENERGY_SYSTEM_META.ATP_PC, MIX: ENERGY_SYSTEM_META.MIXED_UNALLOCATED }
function purposeLabel(value: OracleTrainingPurpose): string {
  if (value === "SPEED") return "스피드 (SPEED)"
  if (value === "OTHER") return "기타 (OTHER)"
  const meta = purposeMeta[value]
  return `${meta.shortLabel} (${meta.code})`
}

// Editorial examples are explicitly synthetic, never inserted into personal facts.
const education: Readonly<Record<string, readonly string[]>> = {
  D02: ["연속 달리기는 본운동이 이어지고, 반복 구성에는 운동 사이 회복이 들어갑니다. 총거리만 같다고 같은 구성이 되지는 않아요.", "구성을 읽을 때 운동 거리 또는 시간, 반복 수, 회복 방식, 세트 사이 회복을 각각 확인해요. 이 설명은 특정 훈련을 대신 선택하는 처방이 아니에요."],
  D03: ["회복을 읽을 때는 어느 반복 뒤인지, 멈춤인지 움직임인지, 세트 사이인지부터 구분해요. 마지막 반복 뒤 정리 운동도 반복 사이 회복과 같지 않아요.", "실제 회복 시간이 기록되지 않았다면 처방을 지켰는지 알 수 없어요. 해당 템플릿의 목적과 승인된 설명 없이 모두에게 같은 회복 길이를 제시하지 않아요."],
  D04: ["언덕에서는 경사, 노면, 오르내리는 방향과 회복 구간이 평지와 달라져요. 기록된 경사와 실제 구성부터 읽어요.", "평지 경기의 평균 페이스를 언덕 목표로 복사하지 않아요. 경사를 모르면 보정 속도나 개인의 적정 반복 수를 만들어 내지 않아요."],
  D05: ["짧은 구간은 거리만으로 목적이 정해지지 않아요. 의도한 출력, 반복 수, 회복, 세트 배치를 함께 읽어야 해요.", "모든 짧은 달리기를 기술 연습으로 축소하거나, 한 에너지 경로만 사용한다고 말하지 않아요. 60m 미만 구간은 경기 페이스 환산 대상이 아니에요."],
  D07: ["웨이트는 사용한 무게와 동작의 세트·반복을, 점프는 동작과 반복 구성을 따로 기록해요. 보조 운동이라는 이름이 같아도 기록 단위는 달라요.", "연구를 읽을 때 대상 선수, 경험, 운동 구성과 측정한 결과를 확인해요. 한 연구의 결과를 모든 러너의 효과나 안전 기준으로 옮기지 않아요."],
  D08: ["선수 사례에서는 누가 언제 어떤 조건에서 했는지와 실제 운동·회복 구성을 확인해요. 출처에서 확인하지 못한 방법을 유명 선수의 이름으로 부르지 않아요.", "사례의 핵심 구성과 자신의 시간·시설·훈련 경험은 따로 놓고 읽어요. 사례 소개만으로 그 훈련을 따라 할 적격성이 생기지는 않아요."],
  E06: ["친구와 비교하는 동의와 외부로 공유하는 동의는 별개예요. 공유 미리보기에는 이번에 선택하고 허용한 사실만 포함해야 해요.", "철회 뒤에는 새 조회와 공유를 중단해야 해요. 이미 내려받은 이미지를 회수할 수 있다고 약속하지 않으며, 개인 메모는 이 풀이에 사용하지 않아요."],
  F03: ["처음인 종목은 거리뿐 아니라 출발 방식, 코스, 라운드와 제한 시간처럼 확인할 항목이 달라요. 관심 종목의 공식 안내와 자신의 경험을 따로 확인해요.", "입력된 기록이 없다는 사실만으로 첫 참가, 경험 부족 또는 재능을 판단하지 않아요. 다른 거리의 기록을 새 종목의 실제 기록으로 옮기지도 않아요."],
  H01: ["ATP-PC 같은 에너지 공급 경로, LT 같은 훈련 목적 표기, MAIN 같은 일정 역할은 서로 다른 분류예요. 같은 표의 서로 경쟁하는 항목으로 더하지 않아요.", "목적별 세션 횟수는 무엇을 기록했는지 보여줍니다. 그 횟수의 비율이 실제 ATP 공급 비율이나 채워야 할 능력의 부족분은 아니에요."],
  H02: ["기전 연구는 작동 방식을, 효과 연구는 정해진 대상과 개입 뒤 결과를 다룹니다. 코칭 판단과 선수 사례는 또 다른 종류의 근거예요.", "출처의 대상, 방법, 확인한 본문 범위를 주장과 함께 읽어요. 논문 링크나 계산 테스트만으로 개인 효과나 자체 질문의 타당성이 검증되지는 않아요."],
  H03: ["경기에서 실제 측정한 시간과 워치 모델이 예상한 경기 시간은 다른 자료예요. 기기 이름과 모델 버전, 입력 조건, 산출 날짜를 함께 확인해요.", "공식 기능 설명과 독립적인 정확도 검증도 구분해요. 공개되지 않은 계산식이나 두 값의 차이를 줄이는 개인 보정식을 만들어 내지 않아요."],
  H04: ["합성 구성 예시: 400m 4회 사이에 회복 60초를 둔 구성과, 400m 2회씩 두 세트로 나누고 세트 사이 별도 회복을 둔 구성은 구조가 달라요.", "두 예시의 운동 거리는 모두 1600m지만 회복이 같다는 뜻은 아니에요. 이는 구조 설명용 합성 예시이며 개인 처방이 아니고, 거리 그림은 시간 비례 그림이 아니에요."],
  H05: ["합성 퀴즈: 같은 날 오전 5km, 오후 3km를 각각 기록했다면 운동 날짜와 세션은 몇 개일까요?", "해설: 서로 다른 실제 세션이라면 날짜 1일, 세션 2회, 기록된 거리 8km예요. 같은 기록을 두 번 받은 것이라면 중복을 먼저 제외해요. 정답은 신체 능력 점수가 아니에요."],
  H06: ["합성 일지 예시: 400m 6회 목표 90~94초, 실제 92·91·93·94·92·95초. 경계를 포함하면 목표 범위 안은 6회 중 5회예요.", "회복 기록은 제시되지 않았으므로 회복 준수 여부는 미확인입니다. 마지막 반복이 늦어진 이유나 훈련 효과도 이 숫자만으로 알 수 없어요. 실제 사용자 일지가 아닌 학습용 사례예요."],
}

type SourceKey = Exclude<keyof OracleContentReaderInput, "today">
type MutableReading = { facts: OracleReadingFact[]; paragraphs: string[]; missing: Set<string>; states: Record<string, OracleReadingStatus>; versions: Record<string, string> }

class Reader {
  readonly result: MutableReading = { facts: [], paragraphs: [], missing: new Set(), states: {}, versions: {} }
  constructor(readonly input: OracleContentReaderInput) {}

  read<T>(key: string, source: OracleReaderSource<T> | undefined): T | null {
    if (!source) { this.result.states[key] = "MISSING"; this.need(key, false); return null }
    if (source.state !== "READY") {
      this.result.states[key] = ["MISSING", "UNAVAILABLE", "REVOKED"].includes(source.state) ? source.state : "UNAVAILABLE"
      this.need(key, false)
      return null
    }
    if (!opaque.safeParse(source.sourceVersion).success) {
      this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:version`, false); return null
    }
    if (source.data === null || source.data === undefined) { this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:invalid`, false); return null }
    this.result.states[key] = "SUFFICIENT"
    if (source.coverage === "PARTIAL") { this.result.states[key] = "PARTIAL"; this.need(`${key}:partial-source`, false) }
    this.result.versions[key] = source.sourceVersion
    return source.data
  }

  parsed<T>(key: string, source: OracleReaderSource<unknown> | undefined, schema: z.ZodType<T>): T | null {
    const raw = this.read(key, source)
    if (raw === null) return null
    const parsed = schema.safeParse(raw)
    if (parsed.success) return parsed.data
    this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:invalid`, false); return null
  }

  need(key: string, present: boolean): void { if (!present) this.result.missing.add(key) }
  text(value: string): void { this.result.paragraphs.push(value) }
  ref(source: string, provenance: OracleReaderProvenance = "EXPLICIT", itemId?: string, date?: string): OracleReaderRef {
    return { source, sourceVersion: this.result.versions[source]!, provenance, ...(itemId ? { itemId } : {}), ...(date ? { date } : {}) }
  }
  fact(id: string, title: string, value: number | string, unit: OracleReadingUnit, metric: OracleReadingMetric, refs: OracleReaderRef[], extra: Partial<Pick<OracleReadingFact, "denominator" | "period" | "owner">> = {}): void {
    if (typeof value === "number" && !Number.isFinite(value)) { this.need(`${id}:finite`, false); return }
    this.result.facts.push({ id, label: title, value, unit, metric, sourceRefs: refs, owner: refs.some(r => r.source.startsWith("friend.")) ? "FRIEND" : "SELF", ...extra })
  }
  answers(key = "answers", source = this.input.answers): OracleReaderAnswers | null { return this.parsed(key, source, answersSchema) }
  conditions(key = "conditions", source = this.input.conditions): OracleReaderConditions | null { return this.parsed(key, source, conditionsSchema) }
  direct(key: string, title: string, value: string | readonly string[] | undefined, source = "answers", metric: OracleReadingMetric = "DIRECT"): void {
    this.need(key, value !== undefined)
    if (value === undefined) return
    const values = typeof value === "string" ? [value] : [...new Set(value)]
    this.fact(key, title, values.length ? values.map(label).join(" · ") : "선택 없음", "category", metric, [this.ref(source)])
  }
  profile(key = "profile", source = this.input.profile): OracleProfileRevision | null {
    const raw = this.read(key, source)
    if (!raw) return null
    if (typeof raw.answers !== "object" || raw.answers === null || Array.isArray(raw.answers)) {
      this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:invalid-answers`, false); return null
    }
    // Select public contract fields before validation; unrelated private properties are never read.
    const parsed = oracleProfileRevisionSchema.safeParse({ version: raw.version, revision: raw.revision, answeredAt: raw.answeredAt,
      questionVersion: raw.questionVersion, scoreVersion: raw.scoreVersion, characterVersion: raw.characterVersion,
      answers: Object.fromEntries(ORACLE_QUESTIONS.filter(q => raw.answers && raw.answers[q.id] !== undefined).map(q => [q.id, raw.answers[q.id]])), selectedCharacter: raw.selectedCharacter })
    if (!parsed.success || parsed.data.answeredAt.slice(0, 10) > this.input.today) {
      this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:version-or-date`, false); return null
    }
    return parsed.data
  }
  axis(axisId: OracleAxisId): void {
    const profile = this.profile()
    if (!profile) return
    const score = scoreOracleResponses(profile.answers).find(s => s.axisId === axisId)!
    const refs = [this.ref("profile", "SELF_REPORTED", `${axisId}:${profile.revision}`, profile.answeredAt.slice(0, 10))]
    for (const item of score.evidence) if (item.response !== null) {
      this.fact(item.questionId, ORACLE_QUESTIONS.find(q => q.id === item.questionId)!.text,
        typeof item.response === "number" ? item.response : label(item.response), "answer", "DIRECT", refs)
    }
    if (score.display !== null) this.fact(`${axisId}:index`, `${score.label} · 내 응답 기준`, score.display, "index", "M01", refs, { denominator: 100 })
    this.need(`${axisId}:three-numeric-answers`, score.state === "COMPLETE")
    this.text(describeOracleAxis(score))
  }
  unique<T extends { id: string }>(rows: readonly T[], key: string): T[] {
    const grouped = new Map<string, T[]>()
    rows.forEach(row => grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]))
    return [...grouped.entries()].flatMap(([id, group]) => {
      if (group.some(row => JSON.stringify(row) !== JSON.stringify(group[0]))) { this.need(`${key}:conflict:${id}`, false); return [] }
      return [group[0]!]
    })
  }
  records(key = "records", source = this.input.records): AthleteRecord[] {
    const raw = this.read(key, source)
    if (!raw) return []
    if (!Array.isArray(raw)) { this.result.states[key] = "UNAVAILABLE"; return [] }
    const invalidIds = new Set<string>()
    const valid = raw.flatMap(record => {
      if (!record || typeof record !== "object") { this.need(`${key}:invalid`, false); return [] }
      const parsed = parseAthleteRecord({ schemaVersion: record.schemaVersion, id: record.id, eventDistanceM: record.eventDistanceM,
        performanceSeconds: record.performanceSeconds, purpose: record.purpose, achievedOn: record.achievedOn, seasonId: record.seasonId,
        enteredBy: record.enteredBy, verificationState: record.verificationState, sourceRef: record.sourceRef, savedAt: record.savedAt }, new Date(`${this.input.today}T12:00:00`))
      if (!parsed) {
        if (typeof record.id === "string") invalidIds.add(record.id)
        this.need(`${key}:invalid`, false); return []
      }
      if (parsed.purpose === "RACE_GOAL") return []
      if (!parsed.achievedOn || parsed.verificationState === "UNVERIFIED") { invalidIds.add(parsed.id); this.need(`${key}:date-or-verification`, false); return [] }
      return [parsed]
    })
    const result = this.unique(valid, key).filter(r => !invalidIds.has(r.id)).sort((a, b) => b.achievedOn!.localeCompare(a.achievedOn!) || a.id.localeCompare(b.id))
    if (invalidIds.size && !result.length) this.result.states[key] = "UNAVAILABLE"
    this.need(`${key}:actual-record`, result.length > 0)
    return result
  }
  raceRef(record: AthleteRecord, source = "records"): OracleReaderRef {
    return this.ref(source, record.verificationState === "VERIFIED" ? "VERIFIED_RECORD" : "SELF_REPORTED", record.id, record.achievedOn!)
  }
  race(record: AthleteRecord, source = "records", prefix = "record"): void {
    const refs = [this.raceRef(record, source)]
    this.fact(`${source}:${prefix}:${record.id}:time`, `${record.eventDistanceM}m · ${record.achievedOn}`, record.performanceSeconds, "s", "DIRECT", refs)
    this.text(`${record.achievedOn}에 달성한 ${record.eventDistanceM}m 기록이에요. ${record.verificationState === "VERIFIED" ? "검증된 기록" : "직접 입력한 기록"}이며, 오늘의 경기력으로 자동 해석하지 않아요.`)
  }
  pace(record: AthleteRecord, source = "records"): void {
    this.race(record, source)
    const event = READING_EVENTS.find(e => e.meters === record.eventDistanceM)
    const existing = event ? readPersonalRecord({ eventId: event.id, seconds: record.performanceSeconds, achievedOn: record.achievedOn }) : null
    const perKm = existing?.paceSeconds ?? record.performanceSeconds * 1000 / record.eventDistanceM
    const per400 = existing?.lapSeconds ?? record.performanceSeconds * 400 / record.eventDistanceM
    for (const [distance, seconds] of [[200, per400 / 2], [400, per400], [1000, perKm]] as const) {
      this.fact(`${source}:${record.id}:pace:${distance}`, `${distance}m 평균 환산`, seconds,
        distance === 1000 ? "s/km" : distance === 400 ? "s/400m" : "s/200m", "M03", [this.raceRef(record, source)])
    }
  }
  training(key = "training", source = this.input.training): OracleReaderTraining | null {
    const raw = this.read(key, source)
    if (!raw) return null
    const header = z.object({ period: periodSchema, coverage: z.enum(["COMPLETE", "PARTIAL"]), sessions: z.array(z.unknown()) }).safeParse(raw)
    if (!header.success || header.data.period.endDate > this.input.today) { this.result.states[key] = "UNAVAILABLE"; this.need(`${key}:period`, false); return null }
    const invalidIds = new Set<string>()
    const sessions = header.data.sessions.flatMap(row => {
      const parsed = sessionSchema.safeParse(row)
      if (!parsed.success) {
        if (row && typeof row === "object" && "id" in row && typeof row.id === "string") invalidIds.add(row.id)
        this.need(`${key}:invalid-session`, false); return []
      }
      const s = parsed.data
      return [s]
    })
    const unique = this.unique(sessions, key).filter(s => !invalidIds.has(s.id) && s.date >= header.data.period.startDate && s.date <= header.data.period.endDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    if (invalidIds.size && !unique.length) this.result.states[key] = "UNAVAILABLE"
    this.need(`${key}:complete-receipt`, header.data.coverage === "COMPLETE")
    this.need(`${key}:sessions`, unique.length > 0)
    return { period: header.data.period, coverage: header.data.coverage, sessions: unique }
  }
  sessionRef(s: OracleReaderSession, source = "training"): OracleReaderRef { return this.ref(source, s.provenance, s.id, s.date) }
  totals(data: OracleReaderTraining, source = "training", mode: "distance" | "purpose" | "dates" | "all" = "all"): void {
    const sessions = data.sessions
    if (!sessions.length) return
    const refs = sessions.map(s => this.sessionRef(s, source))
    const extra = { period: data.period }
    if (mode !== "purpose") {
      this.fact(`${source}:sessions`, "기록된 세션", sessions.length, "count", "M12", refs, extra)
      this.fact(`${source}:days`, "기록된 운동 날짜", new Set(sessions.map(s => s.date)).size, "days", "M12", refs, extra)
    }
    if (mode === "distance" || mode === "all") {
      const runs = sessions.filter(s => s.activity === "RUN")
      const known = runs.filter(s => s.distanceKm !== undefined)
      this.need(`${source}:running-distance`, known.length > 0 && known.length === runs.length)
      if (known.length) this.fact(`${source}:km`, "입력된 달리기 거리 합", known.reduce((n, s) => n + s.distanceKm!, 0), "km", "M11", known.map(s => this.sessionRef(s, source)), { ...extra, denominator: known.length })
    }
    if (mode === "purpose" || mode === "all") {
      const known = sessions.filter(s => s.purpose !== undefined)
      this.fact(`${source}:unclassified`, "목적 미분류 세션", sessions.length - known.length, "count", "M13", refs, { ...extra, denominator: sessions.length })
      this.need(`${source}:purpose`, known.length === sessions.length)
      for (const purpose of [...new Set(known.map(s => s.purpose!))].sort()) {
        this.fact(`${source}:purpose:${purpose}`, `${purposeLabel(purpose)} 목적`, known.filter(s => s.purpose === purpose).length, "count", "M13", refs, { ...extra, denominator: known.length })
      }
    }
    this.text(`${data.period.startDate}~${data.period.endDate}에 전달된 ${sessions.length}개 세션 기준이에요.${data.coverage === "PARTIAL" ? " 일부만 수신되어 전체 기간의 총량은 미확인입니다." : " 기록이 없는 날의 활동 여부는 알 수 없어요."}`)
  }
}

function answerList(r: Reader, key: "motivations" | "raceGoals" | "raceOutcomes" | "todayGoals" | "learningInterests" | "togetherPhases", title: string, source = "answers", answers = r.answers()): void {
  r.direct(key, title, answers?.[key], source, key === "motivations" || key === "raceGoals" ? "M02" : "DIRECT")
  if ((key === "motivations" || key === "raceGoals") && answers?.[key] !== undefined) {
    r.fact(`${key}:count`, `${title} 선택 수 · 순위 아님`, new Set(answers[key]).size, "count", "M02", [r.ref(source)])
  }
}

function preferenceHistory(r: Reader, context: boolean): void {
  const current = r.profile()
  const previous = r.profile("previousProfile", r.input.previousProfile)
  for (const [key, profile] of [["profile", current], ["previousProfile", previous]] as const) {
    if (!profile) continue
    for (const q of ORACLE_QUESTIONS) {
      const value = profile.answers[q.id]
      if (value !== undefined) r.fact(`${key}:${q.id}`, `${key === "profile" ? "현재" : "이전"} · ${q.text}`,
        typeof value === "number" ? value : label(value), "answer", "DIRECT", [r.ref(key, "SELF_REPORTED", q.id, profile.answeredAt.slice(0, 10))])
    }
  }
  if (current && previous) {
    const comparable = current.questionVersion === previous.questionVersion && current.scoreVersion === previous.scoreVersion
      && previous.answeredAt < current.answeredAt && previous.revision < current.revision
    r.need("history:ordered-same-version", comparable)
    if (comparable) {
      const refs = [r.ref("previousProfile", "SELF_REPORTED"), r.ref("profile", "SELF_REPORTED")]
      const pairs = ORACLE_QUESTIONS.filter(q => current.answers[q.id] !== undefined && previous.answers[q.id] !== undefined)
      r.need("history:paired-answers", pairs.length > 0)
      if (pairs.length) {
        const changed = pairs.filter(q => current.answers[q.id] !== previous.answers[q.id])
        r.fact("history:changed", "바뀐 답", changed.length, "count", "M16", refs, { denominator: pairs.length })
        r.fact("history:unchanged", "그대로인 답", pairs.length - changed.length, "count", "M16", refs, { denominator: pairs.length })
      }
      const oldScores = scoreOracleResponses(previous.answers)
      for (const s of scoreOracleResponses(current.answers)) {
        const old = oldScores.find(o => o.axisId === s.axisId)!
        if (s.display !== null && old.display !== null) r.fact(`history:${s.axisId}:delta`, `${s.label} 지수 차이 · 현재 - 이전`, s.display - old.display, "index", "M16", refs)
      }
    }
  }
  if (context) r.direct("context", "직접 선택한 변화 맥락", r.answers()?.context)
  r.text(context ? "선택한 시즌·팀·학업 맥락과 답의 변화를 나란히 읽어요. 그 맥락 때문에 바뀌었다는 인과 판단은 하지 않아요." : "같은 문항과 계산 버전의 두 시점만 비교해요. 더 높아진 지수는 더 좋은 사람이 되었다는 뜻이 아니에요.")
}

function raceComparison(r: Reader): void {
  const records = r.records()
  const recent = records[0]
  if (!recent) return
  const same = records.filter(a => a.eventDistanceM === recent.eventDistanceM)
  const [year, month, day] = r.input.today.split("-").map(Number) as [number, number, number]
  const lastDay = new Date(year - 1, month, 0).getDate()
  const start = `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`
  const best12 = same.filter(a => a.achievedOn! >= start).sort((a, b) => a.performanceSeconds - b.performanceSeconds || a.id.localeCompare(b.id))[0]
  const pb = same.filter(a => a.purpose === "PERSONAL_BEST").sort((a, b) => a.performanceSeconds - b.performanceSeconds || a.id.localeCompare(b.id))[0]
  const roles = new Map<string, { record: AthleteRecord; roles: string[] }>()
  for (const [record, role] of [[recent, "최근 달성"], [best12, "입력된 최근 12개월 최고"], [pb, "입력된 PB"]] as const) {
    if (!record) continue
    const row = roles.get(record.id) ?? { record, roles: [] }
    row.roles.push(role); roles.set(record.id, row)
  }
  for (const { record, roles: names } of roles.values()) {
    r.fact(`race-role:${record.id}`, `${names.join(" · ")} · ${record.achievedOn} · ${record.eventDistanceM}m`, record.performanceSeconds, "s", "DIRECT", [r.raceRef(record)])
  }
  const previous = same.find(a => a.achievedOn! < recent.achievedOn!)
  r.need("records:previous-same-event", previous !== undefined)
  r.need("records:entered-PB", pb !== undefined)
  r.need("records:within-12-months", best12 !== undefined)
  if (previous) {
    const refs = [r.raceRef(previous), r.raceRef(recent)]
    r.fact("race:delta", "최근 - 이전 경기 시간", recent.performanceSeconds - previous.performanceSeconds, "s", "M04", refs)
    r.fact("race:speed-index", "이전 경기 속도 = 100", previous.performanceSeconds / recent.performanceSeconds * 100, "index", "M05", refs, { denominator: 100 })
    r.text(`${previous.achievedOn}과 ${recent.achievedOn}의 같은 ${recent.eventDistanceM}m 기록 비교예요. 시간 차이와 기준 100의 속도 지수는 서로 다른 숫자입니다.`)
  }
  r.text(`최근 12개월 창은 ${start}~${r.input.today}이며 입력된 기록 안에서만 최고를 찾았어요. 오래된 PB를 오늘의 실력으로 간주하지 않아요.`)
}

function fileLapReading(r: Reader, observation: OracleReaderFileLaps): void {
  const meanings = { TIMER: "기록 시간", MOVING: "이동 시간", ELAPSED: "경과 시간", SOURCE_DEFINED: "파일 정의 시간 · 의미 미확정", UNKNOWN: "시간 의미 미확인" }
  const refs: OracleReaderRef[] = [r.ref("laps", "CONFIRMED_FILE", observation.journalEntryId, observation.date),
    { source: "laps.observation", sourceVersion: observation.contentRevisionFingerprint, itemId: observation.sourceObservationKey, date: observation.date, provenance: "CONFIRMED_FILE" }]
  r.result.versions["laps.observation"] = observation.contentRevisionFingerprint
  r.result.versions["laps.policy"] = observation.policyVersion
  r.need("laps:at-least-two", observation.laps.length >= 2)
  for (const lap of observation.laps) {
    const id = `file-lap:${lap.sourceIndex}`; const name = `${lap.sourceIndex + 1}번째 파일 구간`
    r.fact(`${id}:kind`, `${name} · 원본 종류`, lap.kind === "WORK" ? "운동" : lap.kind === "RECOVERY" ? "회복" : "미지정", "category", "DIRECT", refs)
    if (lap.distanceMeters !== null) r.fact(`${id}:distance`, `${name} 거리`, lap.distanceMeters, "m", "DIRECT", refs)
    if (lap.durationSeconds !== null) r.fact(`${id}:time`, `${name} · ${meanings[lap.durationMeaning]}`, lap.durationSeconds, "s", "DIRECT", refs)
    const knownTime = !["SOURCE_DEFINED", "UNKNOWN"].includes(lap.durationMeaning)
    const paired = lap.distanceMeters !== null && lap.distanceMeters > 0 && lap.durationSeconds !== null && lap.durationSeconds > 0
    r.need(`${id}:measurements`, paired)
    r.need(`${id}:time-meaning`, knownTime)
    if (observation.sport === "RUNNING" && paired && knownTime && lap.distanceMeters! >= 60) {
      r.fact(`${id}:pace`, `${name} 평균 · ${meanings[lap.durationMeaning]}`, lap.durationSeconds! * 1000 / lap.distanceMeters!, "s/km", "M03", refs)
    }
  }
  r.need("laps:running-sport", observation.sport === "RUNNING")
  const comparable = observation.sport === "RUNNING" && observation.laps.length >= 2
    && observation.laps.every(lap => lap.distanceMeters !== null && lap.distanceMeters >= 60 && lap.durationSeconds !== null && lap.durationSeconds > 0
      && lap.durationMeaning === observation.laps[0]!.durationMeaning && !["SOURCE_DEFINED", "UNKNOWN"].includes(lap.durationMeaning))
  r.need("laps:comparable-time-meaning", comparable)
  if (comparable) {
    const middle = Math.floor(observation.laps.length / 2)
    const pace = (laps: OracleReaderFileLaps["laps"]) => laps.reduce((n, lap) => n + lap.durationSeconds!, 0) * 1000 / laps.reduce((n, lap) => n + lap.distanceMeters!, 0)
    r.fact("laps:pace-delta", `파일 뒤 ${observation.laps.length - middle}개 - 앞 ${middle}개 구간 · 거리 정규화`,
      pace(observation.laps.slice(middle)) - pace(observation.laps.slice(0, middle)), "s/km", "M10", refs)
  }
  r.text("계정에서 확인된 활동 파일의 원래 구간 순서예요. 경기 기록과 연결된 자료는 아니며 자동 랩을 본운동·회복·경기 전후반으로 추정하지 않아요.")
  r.text("시간은 각 구간의 원래 의미를 유지해요. 활동 전체의 시간 확인으로 구간 시간을 다시 해석하지 않으며, 누락값·0·뜻이 다른 시간은 나란히 비교할 수 있는 구간 계산에 넣지 않아요.")
}

function lapReading(r: Reader, raceOnly = false): OracleReaderLaps | null {
  const laps = r.parsed("laps", r.input.laps, z.union([fileLapsSchema,
    z.object({ kind: z.undefined().optional(), recordId: opaque, date: dateSchema, complete: z.boolean(), segments: z.array(segmentSchema) })]))
  if (!laps) return null
  if (laps.date > r.input.today) { r.result.states.laps = "UNAVAILABLE"; r.need("laps:date", false); return null }
  if (laps.kind === "FILE_ACTIVITY") {
    if (raceOnly) {
      r.need("laps:explicit-race-link", false)
      r.text("활동 파일 구간은 있지만 경기 기록과의 명시적 연결이 없어요. 날짜·거리의 유사성으로 경기 구간이라고 판단하지 않아요.")
    } else fileLapReading(r, laps)
    return null
  }
  const segments = r.unique(laps.segments, "laps")
  const refs = [r.ref("laps", "EXPLICIT", laps.recordId, laps.date)]
  segments.forEach((s, index) => {
    r.fact(`lap:${s.id}:time`, `${index + 1}번째 구간 · ${s.distanceM}m`, s.seconds, "s", "DIRECT", refs)
    if (s.distanceM >= 60) r.fact(`lap:${s.id}:pace`, `${index + 1}번째 구간 평균`, s.seconds * 1000 / s.distanceM, "s/km", "M03", refs)
  })
  r.need("laps:complete", laps.complete && segments.length === laps.segments.length)
  r.need("laps:at-least-two", segments.length >= 2)
  if (segments.length >= 2 && laps.complete && segments.length === laps.segments.length && segments.every(s => s.distanceM >= 60)) {
    const middle = Math.floor(segments.length / 2)
    const pace = (ss: OracleReaderSegment[]) => ss.reduce((n, s) => n + s.seconds, 0) * 1000 / ss.reduce((n, s) => n + s.distanceM, 0)
    const first = pace(segments.slice(0, middle)); const last = pace(segments.slice(middle))
    r.fact("laps:pace-delta", `뒤 ${segments.length - middle}개 - 앞 ${middle}개 구간 · 거리 정규화`, last - first, "s/km", "M10", refs)
    r.text("기록된 순서대로 앞·뒤 구간 묶음의 총시간을 각 거리로 나눴어요. 구간 개수가 홀수이면 뒤 묶음에 한 구간이 더 들어가며, 정확한 경기 전후반 분할과 같다는 뜻은 아니에요.")
  }
  return { ...laps, segments }
}

function sessionDetail(r: Reader, s: OracleReaderSession, source = "training"): void {
  const refs = [r.sessionRef(s, source)]
  r.fact(`${source}:${s.id}:activity`, `${s.date} · ${s.slot ? label(s.slot) : "시각 미상"}`, label(s.activity), "category", "DIRECT", refs)
  const fields = [
    ["distanceKm", "기록된 거리", "km"], ["durationMinutes", "기록된 시간", "min"], ["rpe", "기록된 체감", "RPE"],
    ["heartRateBpm", "기록된 심박", "bpm"], ["sets", "세트", "sets"], ["reps", "반복", "reps"], ["weightKg", "기록된 무게", "kg"],
  ] as const
  for (const [field, title, unit] of fields) if (s[field] !== undefined) r.fact(`${source}:${s.id}:${field}`, `${s.date} · ${title}`, s[field]!, unit, field === "rpe" || field === "heartRateBpm" ? "M19" : "DIRECT", refs)
  for (const component of s.components ?? []) for (const row of component.rows) {
    for (const [field, title, unit] of [["distanceM", "기록 거리", "m"], ["durationSeconds", "기록 시간", "s"],
      ["repetitions", "반복", "reps"], ["sets", "세트", "sets"], ["loadKg", "무게", "kg"], ["contacts", "접지 수", "count"],
      ["recoverySeconds", "반복 사이 회복", "s"], ["setRecoverySeconds", "세트 사이 회복", "s"]] as const) {
      if (row[field] !== undefined) r.fact(`${source}:${s.id}:${component.id}:${row.id}:${field}`, `${label(component.activity)} · ${title}`, row[field]!, unit, "DIRECT", refs)
    }
  }
  for (const step of s.steps ?? []) {
    const title = `${{ warmup: "준비", main: "본운동", cooldown: "정리" }[step.phase]} · ${step.kind === "RECOVERY" ? "회복" : "운동"}`
    if (step.distanceM !== undefined) r.fact(`${source}:${s.id}:${step.id}:distance`, `${title} 실제 거리`, step.distanceM, "m", "DIRECT", refs)
    if (step.seconds !== undefined) r.fact(`${source}:${s.id}:${step.id}:seconds`, `${title} 실제 시간`, step.seconds, "s", "DIRECT", refs)
    if (step.rpe !== undefined) r.fact(`${source}:${s.id}:${step.id}:rpe`, `${title} 실제 RPE`, step.rpe, "RPE", "M19", refs)
  }
  if (!s.segments?.length) return
  const segments = r.unique(s.segments, `${source}:${s.id}:segments`)
  r.need(`${source}:${s.id}:segments-complete`, s.segmentsComplete === true && segments.length === s.segments.length)
  if (!segments.length) return
  r.fact(`${source}:${s.id}:work-distance`, "실제 기록된 반복 거리 합", segments.reduce((n, v) => n + v.distanceM, 0), "m", "M14", refs, { denominator: segments.length })
  const recovery = segments.filter(v => v.recoverySeconds !== undefined)
  r.need(`${source}:${s.id}:recovery-boundary`, s.includesFinalRecovery !== undefined)
  const expected = s.includesFinalRecovery === true ? segments : segments.slice(0, -1)
  const recoveryComplete = s.includesFinalRecovery !== undefined && expected.every(v => v.recoverySeconds !== undefined)
    && (s.includesFinalRecovery || segments.at(-1)?.recoverySeconds === undefined)
  r.need(`${source}:${s.id}:recovery`, recoveryComplete)
  if (recovery.length) r.fact(`${source}:${s.id}:recovery`, `기록된 회복 합 · 마지막 뒤 ${s.includesFinalRecovery === true ? "포함" : s.includesFinalRecovery === false ? "제외" : "미확인"}`,
    recovery.reduce((n, v) => n + v.recoverySeconds!, 0), "s", "M14", refs, { denominator: recovery.length })
  if (segments.length >= 2 && segments.every(v => v.distanceM === segments[0]!.distanceM)) {
    const mean = segments.reduce((n, v) => n + v.seconds, 0) / segments.length
    r.fact(`${source}:${s.id}:repeat-mean`, "동일 거리 반복 평균", mean, "s", "M07", refs, { denominator: segments.length })
    r.fact(`${source}:${s.id}:repeat-min`, "가장 짧은 반복 시간", Math.min(...segments.map(v => v.seconds)), "s", "M07", refs)
    r.fact(`${source}:${s.id}:repeat-max`, "가장 긴 반복 시간", Math.max(...segments.map(v => v.seconds)), "s", "M07", refs)
    if (s.segmentsComplete === true && segments.length === s.segments.length) {
      const sd = Math.sqrt(segments.reduce((n, v) => n + (v.seconds - mean) ** 2, 0) / segments.length)
      r.fact(`${source}:${s.id}:repeat-cv`, "관측 반복 모집단 변동계수", sd / mean * 100, "%", "M08", refs, { denominator: segments.length })
    }
  }
}

function planReading(r: Reader, training?: OracleReaderTraining | null): void {
  const data = training === undefined ? r.training() : training
  const raw = r.parsed("planActual", r.input.planActual, z.array(planSchema))
  if (!raw) return
  const plans = r.unique(raw, "planActual")
  r.need("planActual:original-snapshot", plans.length > 0)
  for (const plan of plans) {
    if (plan.date > r.input.today || (data && (plan.date < data.period.startDate || plan.date > data.period.endDate))) continue
    const original = { ...r.ref("planActual", "ORIGINAL_PLAN", plan.id, plan.date), sourceVersion: plan.originalPlanVersion }
    r.fact(`plan:${plan.id}:completion`, "수행 표시 · 수치 준수 여부와 별개", label(plan.completion), "category", "M15", [original])
    const actual = data?.sessions.find(s => s.id === plan.sessionId && s.date === plan.date)
    r.need(`plan:${plan.id}:linked-actual`, actual !== undefined)
    let numericPairs = 0
    for (const [plannedKey, actualKey, unit] of [["plannedDistanceKm", "distanceKm", "km"], ["plannedDurationMinutes", "durationMinutes", "min"]] as const) {
      if (plan[plannedKey] !== undefined) {
        r.fact(`plan:${plan.id}:${plannedKey}`, `당시 계획 · ${plan.date}`, plan[plannedKey]!, unit, "M15", [original])
        if (actual?.[actualKey] !== undefined && (actualKey !== "distanceKm" || actual.activity === "RUN")
          && (actualKey !== "durationMinutes" || plan.durationComparison === "MATCHED_SCOPE")) {
          numericPairs++
          r.fact(`plan:${plan.id}:${actualKey}:delta`, "실제 - 당시 계획", actual[actualKey]! - plan[plannedKey]!, unit, "M15", [original, r.sessionRef(actual)])
        } else r.need(`plan:${plan.id}:${actualKey}`, false)
      }
    }
    if (plan.plannedRpe) {
      r.fact(`plan:${plan.id}:rpe-min`, "당시 계획 RPE 하한", plan.plannedRpe.min, "RPE", "M15", [original])
      r.fact(`plan:${plan.id}:rpe-max`, "당시 계획 RPE 상한", plan.plannedRpe.max, "RPE", "M15", [original])
      if (actual?.rpe !== undefined) {
        numericPairs++
        r.fact(`plan:${plan.id}:rpe`, "실제 기록된 RPE", actual.rpe, "RPE", "M19", [r.sessionRef(actual)])
        r.fact(`plan:${plan.id}:rpe-comparison`, "당시 RPE 범위와 비교", actual.rpe < plan.plannedRpe.min ? "하한보다 낮음" : actual.rpe > plan.plannedRpe.max ? "상한보다 높음" : "범위 안", "category", "M15", [original, r.sessionRef(actual)])
      } else r.need(`plan:${plan.id}:actual-rpe`, false)
    }
    if (plan.plannedDurationMinutesRange) {
      const range = plan.plannedDurationMinutesRange
      r.fact(`plan:${plan.id}:duration-min`, "당시 계획 시간 하한", range.min, "min", "M15", [original])
      r.fact(`plan:${plan.id}:duration-max`, "당시 계획 시간 상한", range.max, "min", "M15", [original])
      if (actual?.durationMinutes !== undefined && plan.durationComparison === "MATCHED_SCOPE") {
        numericPairs++
        r.fact(`plan:${plan.id}:duration-comparison`, "실제 시간과 당시 범위", actual.durationMinutes < range.min ? "하한보다 짧음" : actual.durationMinutes > range.max ? "상한보다 김" : "범위 안", "category", "M15", [original, r.sessionRef(actual)])
      } else r.need(`plan:${plan.id}:matching-duration-scope`, false)
    }
    if (plan.segmentTargets?.length) {
      const targets = plan.segmentTargets
      const ids = new Set(targets.map(t => t.segmentId))
      if (ids.size !== targets.length) { r.need(`plan:${plan.id}:target-conflict`, false); continue }
      const segments = r.unique(actual?.segments ?? [], `plan:${plan.id}:actual-segments`)
      const pairs = targets.flatMap(t => {
        const segment = segments.find(s => s.id === t.segmentId && s.distanceM === t.distanceM)
        return segment ? [{ target: t, segment }] : []
      })
      r.need(`plan:${plan.id}:all-targets-observed`, pairs.length === targets.length)
      if (pairs.length && actual) {
        numericPairs++
        r.fact(`plan:${plan.id}:in-range`, "당시 목표 범위 안 · 양쪽 경계 포함", pairs.filter(({ target: t, segment: s }) => s.seconds >= t.minSeconds && s.seconds <= t.maxSeconds).length,
          "count", "M09", [original, r.sessionRef(actual)], { denominator: pairs.length })
      }
    }
    if (plan.pointTargets?.length) {
      const targets = plan.pointTargets
      const unique = new Set(targets.map(t => t.segmentId)).size === targets.length
      r.need(`plan:${plan.id}:unique-point-targets`, unique)
      if (unique) {
        const segments = r.unique(actual?.segments ?? [], `plan:${plan.id}:actual-segments`)
        for (const target of targets) {
          const segment = segments.find(s => s.id === target.segmentId && s.distanceM === target.distanceM)
          r.need(`plan:${plan.id}:${target.segmentId}:actual`, segment !== undefined)
          r.fact(`plan:${plan.id}:${target.segmentId}:target`, `당시 ${target.distanceM}m 목표`, target.seconds, "s", "M15", [original])
          if (segment && actual) {
            numericPairs++
            r.fact(`plan:${plan.id}:${target.segmentId}:delta`, "실제 구간 - 당시 목표", segment.seconds - target.seconds, "s", "M15", [original, r.sessionRef(actual)])
          }
        }
      }
    }
    if (plan.stepTargets?.length) {
      const unique = new Set(plan.stepTargets.map(t => t.stepId)).size === plan.stepTargets.length
      r.need(`plan:${plan.id}:unique-step-targets`, unique)
      if (unique) {
        const steps = r.unique(actual?.steps ?? [], `plan:${plan.id}:actual-steps`)
        for (const target of plan.stepTargets) {
          const step = steps.find(s => s.id === target.stepId)
          const comparable = step?.seconds !== undefined && (target.distanceM === undefined || step.distanceM === target.distanceM)
          r.need(`plan:${plan.id}:${target.stepId}:comparable`, comparable)
          r.fact(`plan:${plan.id}:${target.stepId}:target-min`, "당시 구간 시간 하한", target.minSeconds, "s", "M15", [original])
          r.fact(`plan:${plan.id}:${target.stepId}:target-max`, "당시 구간 시간 상한", target.maxSeconds, "s", "M15", [original])
          if (comparable && actual) {
            numericPairs++
            const refs = [original, r.sessionRef(actual)]
            r.fact(`plan:${plan.id}:${target.stepId}:actual`, "실제 기록된 구간 시간", step!.seconds!, "s", "M15", [r.sessionRef(actual)])
            r.fact(`plan:${plan.id}:${target.stepId}:range`, "당시 구간 범위와 비교", step!.seconds! < target.minSeconds ? "하한보다 짧음" : step!.seconds! > target.maxSeconds ? "상한보다 김" : "범위 안", "category", "M15", refs)
          }
        }
      }
    }
    r.need(`plan:${plan.id}:numeric-comparison`, numericPairs > 0)
  }
  r.text("당시 저장된 계획의 버전을 그대로 읽었어요. 완료 표시는 실제 반복·회복 수치를 보증하지 않으며, 새 PB나 현재 선호로 과거 목표를 다시 계산하지 않아요.")
}

function methodReading(r: Reader, includePreference: boolean): void {
  const method = r.parsed("method", r.input.method, methodSchema)
  const conditions = r.conditions()
  const answers = includePreference ? r.answers() : null
  if (includePreference) {
    r.direct("movementForm", "직접 좋아한 형태", answers?.movementForm)
    answerList(r, "todayGoals", "직접 정한 당일 목적", "answers", answers)
  }
  if (!method) return
  const refs = [r.ref("method", method.catalog ? "REVIEWED_CATALOG" : "ORIGINAL_PLAN", method.id)]
  r.fact("method:purpose", "검토할 방법의 목적", purposeLabel(method.purpose), "category", "DIRECT", refs)
  if (method.form) r.fact("method:form", "방법의 운동 형태", label(method.form), "category", "DIRECT", refs)
  if (includePreference) r.need("method:running-form", method.form !== undefined)
  if (includePreference && answers?.movementForm && method.form) r.fact("method:form-match", "선택한 형태와 방법 비교", answers.movementForm === "BOTH" || answers.movementForm === method.form ? "형태 선택에 포함" : "선택한 형태와 다름", "category", "DIRECT", [...refs, r.ref("answers")])
  if (method.catalog) {
    r.result.versions["method.catalog"] = method.catalog.version
    r.result.versions["method.catalog-content"] = method.catalog.fingerprint
    r.result.versions["method.calculation"] = method.catalog.calculationFingerprint
    refs.push({ source: "method.calculation", sourceVersion: method.catalog.calculationFingerprint, itemId: method.id, provenance: "REVIEWED_CATALOG" })
    r.fact("method:modalities", "원본 본운동의 운동 종류", method.catalog.modalities.map(value => ({ RUN: "달리기", WALK: "걷기", BIKE: "자전거", ELLIPTICAL: "일립티컬", DEEP_WATER_RUN: "수중 달리기", SWIM: "수영" })[value]).join(" · "), "category", "DIRECT", refs)
    r.fact("method:terrains", "원본 본운동의 지형", method.catalog.terrains.map(value => ({ FLAT: "평지", INDOOR: "실내", POOL: "수영장", UPHILL: "오르막", ROLLING: "기복 지형" })[value]).join(" · "), "category", "DIRECT", refs)
    const names: Record<OracleCatalogRequirement, string> = {
      ACCELERATION_AND_DECELERATION_SPACE: "가속·감속 공간", HIGH_INTENSITY_REPETITION_EXPERIENCE: "고강도 반복 경험",
      RECENT_LONG_RUN_BASELINE: "최근 장거리 훈련 기준", RECENT_THRESHOLD_VOLUME: "최근 역치 훈련량 기준", COMPOUND_TRAINING_EXPERIENCE: "복합 훈련 경험",
      BIKE_AVAILABLE: "자전거 사용 가능", ELLIPTICAL_AVAILABLE: "일립티컬 사용 가능", WATER_SAFETY_AND_EQUIPMENT: "수중 안전·장비",
      SWIMMING_ABILITY_AND_WATER_SAFETY: "수영 능력·수중 안전", HILL_SURFACE_GRADE_RETURN: "언덕 노면·경사·복귀", CONNECTED_HILL_FLAT_ROUTE: "연결된 언덕·평지 경로",
    }
    for (const requirement of method.catalog.requirements) r.fact(`method:requirement:${requirement}`, "원본의 필수 확인 조건", names[requirement], "category", "DIRECT", refs)
    r.text("선택된 카탈로그 구성과 저장된 계산 입력을 재검증한 설명이에요. 과거 조건 확인이 오늘의 환경·몸 상태·처방 적격성을 보증하지 않아요. 평지라는 표기를 트랙이나 도로로 바꾸지 않아요.")
  }
  let checked = 0
  if (method.requiredMinutesRange) {
    r.fact("method:minutes-min", "준비·회복·정리 포함 시간 하한", method.requiredMinutesRange.min, "min", "DIRECT", refs)
    r.fact("method:minutes-max", "준비·회복·정리 포함 시간 상한", method.requiredMinutesRange.max, "min", "DIRECT", refs)
    r.need("conditions:availableMinutes", conditions?.availableMinutes !== undefined)
    if (conditions?.availableMinutes !== undefined) {
      checked++
      r.fact("method:minutes-gap-to-max", "가능 시간 - 구성 시간 상한", conditions.availableMinutes - method.requiredMinutesRange.max, "min", "DIRECT", [...refs, r.ref("conditions")])
    }
  }
  if (method.requiredMinutes !== undefined) {
    r.fact("method:minutes", "방법에 필요한 시간", method.requiredMinutes, "min", "DIRECT", refs)
    r.need("conditions:availableMinutes", conditions?.availableMinutes !== undefined)
    if (conditions?.availableMinutes !== undefined) {
      checked++
      r.fact("method:minutes-gap", "가능 시간 - 필요 시간", conditions.availableMinutes - method.requiredMinutes, "min", "DIRECT", [...refs, r.ref("conditions")])
    }
  }
  for (const key of ["places", "equipment"] as const) {
    if (method[key] === undefined) continue
    r.need(`conditions:${key}`, conditions?.[key] !== undefined)
    if (conditions?.[key] !== undefined) {
      checked++
      const matches = method[key]!.filter(v => (conditions[key] as readonly string[]).includes(v))
      r.fact(`method:${key}`, key === "places" ? "겹치는 장소 조건" : "일치하는 장비 항목", matches.length ? matches.map(label).join(" · ") : "일치 항목 없음", "category", "DIRECT", [...refs, r.ref("conditions")])
    }
  }
  r.need("method:checkable-conditions", checked > 0)
  r.text("위 비교는 입력된 시간·장소·장비 조건만 확인합니다. 목적·부하·회복·안전 적격성이나 훈련 효과를 판정하지 않아요.")
}

function friendReading(r: Reader, topicId: string): void {
  const friend = r.read("friend", r.input.friend)
  if (!friend) return
  if (friend.permission !== "COMPARISON_ALLOWED") { r.result.states.friend = "UNAVAILABLE"; r.need("friend:permission", false); return }
  if (topicId === "E01") {
    const own = r.records()
    const theirs = r.records("friend.records", friend.records)
    const a = own.find(record => theirs.some(other => other.eventDistanceM === record.eventDistanceM)) ?? own[0]
    const b = a ? theirs.find(record => record.eventDistanceM === a.eventDistanceM) : undefined
    if (a) r.pace(a)
    if (b) r.pace(b, "friend.records")
    r.need("friend:same-event-record", !!a && !!b)
    if (a && b) r.fact("friend:race-delta", "친구 - 내 기록 시간 · 같은 종목", b.performanceSeconds - a.performanceSeconds, "s", "M04", [r.raceRef(a), r.raceRef(b, "friend.records")], { owner: "COMPARISON" })
    r.text("선택적으로 전달된 같은 종목의 최근 기록만 비교했어요. 친구의 다른 자료나 공동 훈련 페이스를 추정하지 않아요.")
    return
  }
  if (topicId === "E03") {
    const own = r.profile()
    const theirs = r.profile("friend.profile", friend.profile)
    if (!own || !theirs) return
    if (own.questionVersion !== theirs.questionVersion) { r.need("friend:same-question-version", false); return }
    const questions = ORACLE_QUESTIONS.filter(q => typeof own.answers[q.id] === "number" && typeof theirs.answers[q.id] === "number")
    r.need("friend:comparable-numeric-answers", questions.length > 0)
    if (!questions.length) return
    const refs = [r.ref("profile", "SELF_REPORTED"), r.ref("friend.profile", "SELF_REPORTED")]
    for (const q of questions) r.fact(`friend:answer:${q.id}`, q.text, own.answers[q.id] === theirs.answers[q.id] ? "같은 답" : "다른 답", "category", "M17", refs, { owner: "COMPARISON" })
    r.fact("friend:matching-answers", "비교 가능한 답 중 정확히 같은 답", questions.filter(q => own.answers[q.id] === theirs.answers[q.id]).length, "count", "M17", refs, { owner: "COMPARISON", denominator: questions.length })
    r.text("모름·상황별·경험 없음·건너뜀·미응답은 비교 분모에서 제외했어요. 같은 답의 개수는 관계 궁합 점수가 아니에요.")
    return
  }
  if (topicId === "E05") {
    const own = r.training()
    const theirs = r.training("friend.training", friend.training)
    if (own) r.totals(own)
    if (theirs) r.totals(theirs, "friend.training")
    const samePeriod = !!own && !!theirs && own.period.startDate === theirs.period.startDate && own.period.endDate === theirs.period.endDate
    r.need("friend:same-period", samePeriod)
    if (samePeriod && own && theirs && own.coverage === "COMPLETE" && theirs.coverage === "COMPLETE") {
      const ownKm = r.result.facts.find(f => f.id === "training:km")
      const friendKm = r.result.facts.find(f => f.id === "friend.training:km")
      const fullDistances = [own, theirs].every(d => d.sessions.filter(s => s.activity === "RUN").every(s => s.distanceKm !== undefined))
      if (ownKm && friendKm && fullDistances) r.fact("friend:km-delta", "친구 - 내 기록된 달리기 거리", Number(friendKm.value) - Number(ownKm.value), "km", "M11", [...ownKm.sourceRefs, ...friendKm.sourceRefs], { owner: "COMPARISON", period: own.period })
    }
    r.text(samePeriod ? "같은 기간에 공유된 기록을 비교해요. 횟수나 거리 차이는 건강·성실성 점수가 아니에요." : "기간이 달라 각각의 기록을 나란히만 표시했어요. 기간 차이를 무시한 합계 비교는 하지 않아요.")
    return
  }
  const own = r.answers()
  const theirs = r.answers("friend.answers", friend.answers)
  r.direct("own:todayGoals", "내가 직접 정한 당일 목표", own?.todayGoals)
  r.direct("friend:todayGoals", "친구가 직접 정한 당일 목표", theirs?.todayGoals, "friend.answers")
  if (topicId === "E04") {
    if (own?.todayGoals && theirs?.todayGoals) {
      const common = [...new Set(own.todayGoals)].filter(goal => theirs.todayGoals!.includes(goal))
      r.fact("friend:common-goals", "함께 선택한 목표", common.length ? common.map(label).join(" · ") : "공통 선택 없음", "category", "DIRECT", [r.ref("answers"), r.ref("friend.answers")], { owner: "COMPARISON" })
    }
    r.text("목표가 다르면 각자의 목표를 유지한 채 함께할 한 부분을 의논할 수 있어요. 기록만으로 상대의 목적을 추측하지 않아요.")
    return
  }
  r.direct("own:phases", "내가 함께하고 싶은 구간", own?.togetherPhases)
  r.direct("friend:phases", "친구가 함께하고 싶은 구간", theirs?.togetherPhases, "friend.answers")
  if (own?.togetherPhases && theirs?.togetherPhases) {
    const common = [...new Set(own.togetherPhases)].filter(p => theirs.togetherPhases!.includes(p))
    r.fact("friend:common-phases", "둘이 함께 선택한 구간", common.length ? common.map(label).join(" · ") : "공통 선택 없음", "category", "DIRECT", [r.ref("answers"), r.ref("friend.answers")], { owner: "COMPARISON" })
  }
  const ownConditions = r.conditions()
  const theirConditions = r.conditions("friend.conditions", friend.conditions)
  r.need("conditions:meetingWindows", ownConditions?.meetingWindows !== undefined)
  r.need("friend.conditions:meetingWindows", theirConditions?.meetingWindows !== undefined)
  if (ownConditions?.meetingWindows && theirConditions?.meetingWindows) {
    const intersections = ownConditions.meetingWindows.flatMap(a => theirConditions.meetingWindows!.flatMap(b => {
      const start = Math.max(a.startMinute, b.startMinute); const end = Math.min(a.endMinute, b.endMinute)
      return a.date === b.date && start < end ? [{ date: a.date, start, end }] : []
    })).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.end - b.end)
    const merged: typeof intersections = []
    for (const window of intersections) {
      const last = merged.at(-1)
      if (last && last.date === window.date && last.end >= window.start) last.end = Math.max(last.end, window.end)
      else merged.push({ ...window })
    }
    const refs = [r.ref("conditions"), r.ref("friend.conditions")]
    r.fact("friend:meeting-minutes", "함께 선택한 시간의 교집합", merged.reduce((n, w) => n + w.end - w.start, 0), "min", "M18", refs, { owner: "COMPARISON" })
    for (const w of merged) {
      const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
      r.fact(`friend:window:${w.date}:${w.start}`, `${w.date} · 함께 가능한 시간`, `${clock(w.start)}~${clock(w.end)}`, "category", "M18", refs, { owner: "COMPARISON" })
    }
  }
  r.text("겹치는 시간과 함께 선택한 구간만 보여줘요. 실제 위치·공동 강도·공동 페이스나 안전 여부는 계산하지 않아요.")
}

function raceConditions(r: Reader, records: readonly AthleteRecord[], conditions: OracleReaderConditions | null): void {
  let known = 0
  for (const record of records) {
    const context = conditions?.races?.find(c => c.recordId === record.id)
    r.need(`conditions:${record.id}`, context !== undefined)
    if (!context) continue
    const refs = [r.raceRef(record), r.ref("conditions", "EXPLICIT", record.id)]
    for (const key of ["course", "weather", "round", "goal"] as const) if (context[key] !== undefined) {
      known++
      r.fact(`condition:${record.id}:${key}`, `${record.achievedOn} · ${{ course: "코스", weather: "날씨", round: "라운드", goal: "목표" }[key]}`,
        key === "round" ? raceRoundLabels[context.round!] : label(context[key]!), "category", "DIRECT", refs)
    }
  }
  r.need("conditions:known-race-facts", known > 0)
}

function readTopic(r: Reader, topicId: string): void {
  switch (topicId) {
    case "A01": {
      const answers = r.answers()
      if (answers?.motivations !== undefined) answerList(r, "motivations", "직접 고른 달리기 동기", "answers", answers)
      else { r.axis("CHALLENGE"); r.axis("REFRESH") }
      r.text("직접 선택한 동기는 함께 남겨두며 자동으로 순위를 매기지 않아요. 기록 도전과 기분 전환이 함께 있어도 서로 모순되는 답은 아니에요.")
      break
    }
    case "A02": r.axis("INTENSITY"); break
    case "A03": {
      r.axis("STRUCTURE")
      const conditions = r.conditions()
      r.need("conditions:availableMinutes", conditions?.availableMinutes !== undefined)
      if (conditions?.availableMinutes !== undefined) r.fact("availableMinutes", "직접 입력한 가능 시간", conditions.availableMinutes, "min", "DIRECT", [r.ref("conditions")])
      r.text("계획을 좋아한다는 답과 가능한 시간은 다른 사실이에요. 여건이 비어 있으면 일정을 지킬 수 있는지는 판단하지 않아요.")
      break
    }
    case "A04": r.direct("movementForm", "직접 고른 달리기 형태", r.answers()?.movementForm); r.text("연속 달리기는 운동이 이어지고, 나눠 달리기는 운동 사이에 회복이 있어요. 두 형태 모두 강도를 다양하게 구성할 수 있어 강도 답으로 형태를 대신 채우지 않아요."); break
    case "A05": {
      const answers = r.answers()
      r.direct("company", "직접 고른 동행 방식", answers?.company)
      r.direct("conversation", "대화 선호", answers?.conversation)
      if (r.input.profile) r.axis("SOCIAL")
      r.text("혼자 달리기와 함께 달리기, 대화가 편한지는 각각의 선택이에요. 동행 선호로 사회성이나 친구 관계를 평가하지 않아요.")
      break
    }
    case "A06": {
      const profile = r.profile()
      if (!profile) break
      let answered = 0
      for (const score of scoreOracleResponses(profile.answers)) {
        if (score.state === "UNANSWERED") continue
        answered++
        const refs = [r.ref("profile", "SELF_REPORTED", score.axisId)]
        for (const e of score.evidence) if (e.response !== null) r.fact(e.questionId, ORACLE_QUESTIONS.find(q => q.id === e.questionId)!.text, typeof e.response === "number" ? e.response : label(e.response), "answer", "DIRECT", refs)
        if (score.display !== null) r.fact(`${score.axisId}:index`, score.label, score.display, "index", "M01", refs, { denominator: 100 })
        r.fact(`${score.axisId}:pattern`, `${score.label} 답 구성`, score.mixed ? "낮은 동의와 높은 동의가 함께 있음" : score.state === "PARTIAL" ? "숫자 응답 일부 또는 비수치 답" : "세 문항 숫자 응답", "category", "DIRECT", refs)
        r.text(`${score.label}: ${describeOracleAxis(score)}`)
        r.need(`${score.axisId}:complete`, score.state === "COMPLETE")
      }
      r.need("profile:answered-axis", answered > 0)
      break
    }
    case "A07": preferenceHistory(r, true); break
    case "A08": {
      const answers = r.answers()
      r.direct("familiarEnjoyment", "익숙한 방식의 즐거움", answers?.familiarEnjoyment)
      answerList(r, "learningInterests", "직접 고른 배울 관심", "answers", answers)
      if (r.input.profile) r.axis("EXPLORE")
      r.text("익숙한 방식이 좋은 것과 새로 배우고 싶은 것은 함께 있을 수 있어요. 경험 없음은 낮은 능력이나 낮은 등급이 아니에요.")
      break
    }
    case "B01": case "B05": {
      const record = r.records()[0]
      if (record) r.pace(record)
      r.text(topicId === "B01" ? "이 구간 초는 경기 전체를 평균 속도로 나눈 값이에요. 실제 랩이나 반복훈련 목표가 아니에요." : "한 경기로 확인하는 것은 달성 날짜·거리·시간과 평균 환산이에요. CS·ASR·재능·미래 경기 예측은 이 한 기록에서 만들지 않아요.")
      break
    }
    case "B02": raceComparison(r); break
    case "B03": {
      const records = r.records()
      records.forEach(record => r.race(record))
      r.need("records:multiple-events", new Set(records.map(s => s.eventDistanceM)).size > 1)
      r.text("서로 다른 종목은 실제 기록만 나란히 표시해요. 별도 승인된 모델·점수표가 없는 M20은 계산하지 않고 종목 간 우열도 정하지 않아요.")
      break
    }
    case "B04": lapReading(r); r.text("남아 있는 구간의 시간과 거리만 읽어요. 빠진 구간을 보간하거나 마지막 스퍼트를 만들어 내지 않아요."); break
    case "B06": {
      const goal = r.parsed("goal", r.input.goal, z.object({ eventDistanceM: z.number().finite().min(60), performanceSeconds: positive }))
      const records = r.records()
      if (goal) {
        const refs = [r.ref("goal", "SELF_REPORTED")]
        r.fact("goal:time", `${goal.eventDistanceM}m 목표 · 달성 기록 아님`, goal.performanceSeconds, "s", "M06", refs)
        const actual = records.find(record => record.eventDistanceM === goal.eventDistanceM)
        r.need("goal:same-event-actual", actual !== undefined)
        if (actual) {
          r.race(actual)
          r.fact("goal:delta", "목표 - 실제 기록", goal.performanceSeconds - actual.performanceSeconds, "s", "M06", [...refs, r.raceRef(actual)])
          for (const [distance, unit] of [[200, "s/200m"], [400, "s/400m"], [1000, "s/km"]] as const) r.fact(`goal:delta:${distance}`, `${distance}m 평균 환산 · 목표 - 실제`, (goal.performanceSeconds - actual.performanceSeconds) * distance / goal.eventDistanceM, unit, "M06", [...refs, r.raceRef(actual)])
        }
      }
      r.text("목표는 아직 달성하지 않은 별도 값이에요. 이 차이는 달성 확률이 아니며 기존 계획 변경을 자동 실행하지 않아요.")
      break
    }
    case "B07": {
      const device = r.parsed("device", r.input.device, z.object({ eventDistanceM: z.number().min(60), performanceSeconds: positive, date: dateSchema, modelVersion: opaque }))
      const records = r.records()
      if (device && device.date <= r.input.today) {
        const refs = [r.ref("device", "DEVICE_ESTIMATE", device.modelVersion, device.date)]
        r.fact("device:prediction", `${device.date} · ${device.eventDistanceM}m 기기 예상 · ${device.modelVersion}`, device.performanceSeconds, "s", "DIRECT", refs)
        const actual = records.find(s => s.eventDistanceM === device.eventDistanceM)
        r.need("device:same-event-actual", !!actual)
        if (actual) { r.race(actual); r.fact("device:delta", "기기 예상 - 실제 기록 · 보정 아님", device.performanceSeconds - actual.performanceSeconds, "s", "DIRECT", [...refs, r.raceRef(actual)]) }
      } else if (device) { r.result.states.device = "UNAVAILABLE"; r.need("device:date", false) }
      else records.slice(0, 1).forEach(s => r.race(s))
      r.text("기기 모델의 예상과 실제 경기의 날짜·출처를 분리했어요. 예상값을 실제 PB로 저장하거나 개인 보정식으로 사용하지 않아요.")
      break
    }
    case "C01": {
      r.direct("movementForm", "직접 좋아한 형태", r.answers()?.movementForm)
      const data = r.training()
      if (data) {
        const known = data.sessions.filter(s => s.form !== undefined)
        for (const form of ["CONTINUOUS", "INTERVAL"] as const) {
          if (known.length) r.fact(`form:${form}`, `${label(form)} 기록`, known.filter(s => s.form === form).length, "count", "DIRECT", known.map(s => r.sessionRef(s)), { denominator: known.length, period: data.period })
        }
        r.need("training:forms", known.length > 0 && known.length === data.sessions.length)
      }
      r.text("좋아한다고 직접 고른 형태와 실제 적격 기록의 횟수를 나눠 표시해요. 차이가 있어도 의지 부족이나 회복 능력으로 풀이하지 않아요.")
      break
    }
    case "C02": { const data = r.training(); if (data) r.totals(data, "training", "purpose"); r.text("목적을 확인한 세션 수가 분모예요. MIX는 별도로 남기고 MAIN 같은 일정 역할을 목적과 더하지 않아요."); break }
    case "C03": {
      const data = r.training()
      if (data) {
        r.totals(data, "training", "dates")
        for (const date of [...new Set(data.sessions.map(s => s.date))]) {
          const sessions = data.sessions.filter(s => s.date === date)
          const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T12:00:00`).getDay()]
          r.fact(`date:${date}`, `${date} ${weekday}요일`, sessions.length, "count", "M12", sessions.map(s => r.sessionRef(s)), { period: data.period })
        }
      }
      break
    }
    case "C04": {
      const data = r.training()
      if (data) {
        r.totals(data, "training", "dates")
        data.sessions.forEach(s => sessionDetail(r, s))
        r.need("training:multiple-sessions-same-date", data.sessions.some(s => data.sessions.filter(other => other.date === s.date).length > 1))
      }
      r.text("같은 날짜라도 서로 다른 세션 ID만 별도 세션으로 셌어요. 시각 정보가 없으면 오전·오후를 추측하지 않아요.")
      break
    }
    case "C05": {
      const answers = r.answers(); const conditions = r.conditions()
      r.direct("supplementaryExperience", "보조 운동 경험", answers?.supplementaryExperience)
      r.direct("supplementaryInterest", "보조 운동 관심", answers?.supplementaryInterest)
      r.direct("equipment", "직접 선택한 장비", conditions?.equipment, "conditions")
      r.need("conditions:availableMinutes", conditions?.availableMinutes !== undefined)
      if (conditions?.availableMinutes !== undefined) r.fact("availableMinutes", "가능 시간", conditions.availableMinutes, "min", "DIRECT", [r.ref("conditions")])
      if (r.input.profile) r.axis("SU")
      r.text("경험, 관심과 할 수 있는 여건은 별개예요. 관심이 없거나 기록이 없다는 이유를 원문 메모에서 찾지 않아요.")
      break
    }
    case "C06": {
      const data = r.training(); const other = data?.sessions.filter(s => s.activity !== "RUN" && s.activity !== "UNKNOWN") ?? []
      other.forEach(s => sessionDetail(r, s)); r.need("training:non-running", other.length > 0)
      r.text("웨이트의 kg·세트·반복, 점프의 반복, 자전거의 거리·시간은 각 운동의 단위로 남겨요. 달리기 km나 하나의 부하 점수로 환산하지 않아요.")
      break
    }
    case "C07": case "G03": planReading(r); break
    case "D01": methodReading(r, true); break
    case "D06": methodReading(r, false); break
    case "E01": case "E02": case "E03": case "E04": case "E05": friendReading(r, topicId); break
    case "E06": {
      if (!r.input.share) break
      const share = r.parsed("share", r.input.share, z.object({ permission: z.literal("EXTERNAL_SHARE_ALLOWED"), selectedFields: z.array(z.enum(["ANSWERS", "RACE_RECORDS", "TRAINING"])) }))
      if (share) r.direct("share:fields", "이번에 선택한 외부 공유 필드", share.selectedFields, "share")
      break
    }
    case "F01": answerList(r, "raceGoals", "이번 대회의 직접 선택 목표"); r.text("완주·기록·경험·순위·예선 통과는 여러 개를 선택할 수 있어요. 목표 개수가 많다고 더 좋은 러너인 것은 아니에요."); break
    case "F02": case "F08": {
      const laps = lapReading(r, true); const answers = r.answers(); const conditions = r.conditions()
      answerList(r, "raceGoals", "직접 정한 경기 목표", "answers", answers)
      const context = conditions?.races?.find(c => c.recordId === laps?.recordId)
      r.need("conditions:matching-race", !!context)
      if (context) for (const key of ["course", "weather", "round", "goal"] as const) r.direct(`race:${key}`,
        `해당 경기의 ${{ course: "코스", weather: "날씨", round: "라운드", goal: "목표" }[key]}`,
        key === "round" && context.round ? raceRoundLabels[context.round] : context[key], "conditions")
      r.text(topicId === "F02" ? "실제 출발 구간을 경기 목표·코스와 함께 읽어요. 빠른 출발만으로 성격이나 경기 실패를 판정하지 않아요." : "기록 도전과 순위·진출 목표는 같은 경기에서도 구분해요. 중거리 전술 경기에 마라톤의 균등 페이스 기준을 일괄 적용하지 않아요.")
      break
    }
    case "F04": {
      const answers = r.answers(); answerList(r, "raceGoals", "직접 정했던 목표", "answers", answers); answerList(r, "raceOutcomes", "직접 남긴 경험·결과", "answers", answers)
      const record = r.records()[0]; if (record) r.race(record)
      r.text("PB 여부와 별개로 직접 선택한 목표와 결과를 나란히 읽어요. 느린 시간에서 추억·경험 목적을 거꾸로 추정하지 않아요.")
      break
    }
    case "F05": {
      const records = r.records().slice(0, 2); records.forEach(s => r.race(s)); raceConditions(r, records, r.conditions())
      r.need("records:two-races", records.length === 2)
      r.text("기록된 날씨·코스·라운드 차이를 보여줘요. 차이가 확인되어도 그 조건 때문에 달라진 초나 보정 기록은 계산하지 않아요.")
      break
    }
    case "F06": answerList(r, "learningInterests", "대회와 별개로 배워 보고 싶은 것"); r.text("루틴이나 새로운 배움은 대회 참가 없이도 관심 주제가 될 수 있어요. 참가 여부로 감점하거나 대회 목표를 강요하지 않아요."); break
    case "F07": {
      const conditions = r.conditions(); const events = conditions?.events ?? []
      r.need("conditions:event-options", events.length >= 2)
      for (const event of events) {
        const refs = [r.ref("conditions", "EXPLICIT", event.id, event.date)]
        r.fact(`event:${event.id}:date`, "직접 입력한 대회 일정", event.date, "date", "DIRECT", refs)
        r.need(`event:${event.id}:cost`, event.cost !== undefined)
        r.need(`event:${event.id}:travel`, event.travelMinutes !== undefined)
        if (event.cost) r.fact(`event:${event.id}:cost`, `입력 비용 · ${event.cost.currency}`, event.cost.amount, "currency", "DIRECT", refs)
        if (event.travelMinutes !== undefined) r.fact(`event:${event.id}:travel`, "입력 이동 시간", event.travelMinutes, "min", "DIRECT", refs)
      }
      r.text("직접 입력한 일정과 비용·이동 시간만 정리했어요. 서로 다른 통화는 더하지 않으며 빈 비용은 0원이 아닙니다. 실시간 예약 정보가 아니에요.")
      break
    }
    case "G01": {
      const data = r.training()
      if (data) for (const month of [...new Set(data.sessions.map(s => s.date.slice(0, 7)))]) {
        const first = `${month}-01`; const date = new Date(`${first}T12:00:00`)
        const last = `${month}-${new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()}`
        const period = { startDate: data.period.startDate > first ? data.period.startDate : first, endDate: data.period.endDate < last ? data.period.endDate : last }
        const scope = `${month} (${period.startDate}~${period.endDate})`
        const before = r.result.facts.length
        r.totals({ ...data, period, sessions: data.sessions.filter(s => s.date.startsWith(month)) }, "training", "distance")
        for (let i = before; i < r.result.facts.length; i++) r.result.facts[i] = { ...r.result.facts[i]!, id: `${month}:${r.result.facts[i]!.id}`, label: `${scope} · ${r.result.facts[i]!.label}` }
        r.need(`${month}:whole-month`, period.startDate === first && period.endDate === last)
      }
      r.text("월별 값은 적격 실제 거리의 합이며 세션 거리 중앙값이 아니에요. 월 중간까지 전달된 자료는 표시한 날짜 범위의 소계로 읽어요.")
      break
    }
    case "G02": {
      const data = r.training(); const previous = r.input.previousTraining ? r.training("previousTraining", r.input.previousTraining) : null
      const candidates = [...(data?.sessions ?? []).map(s => ({ s, source: "training" })), ...(previous?.sessions ?? []).map(s => ({ s, source: "previousTraining" }))]
      const conflicts = new Set(candidates.filter(v => candidates.some(other => other.s.id === v.s.id && JSON.stringify(other.s) !== JSON.stringify(v.s))).map(v => v.s.id))
      r.need("training:cross-period-identity", conflicts.size === 0)
      const pair = candidates.filter(v => !conflicts.has(v.s.id))
        .sort((a, b) => b.s.date.localeCompare(a.s.date) || a.s.id.localeCompare(b.s.id)).filter((v, index, all) => all.findIndex(a => a.s.id === v.s.id) === index).slice(0, 2)
      pair.forEach(({ s, source }) => sessionDetail(r, s, source))
      r.need("training:two-distinct-sessions", pair.length === 2)
      if (pair.length === 2) {
        const a = pair[0]!; const b = pair[1]!
        const comparable = a.s.activity === b.s.activity && a.s.form !== undefined && a.s.form === b.s.form
        r.need("training:comparable-structure", comparable)
        if (comparable) for (const [field, unit] of [["durationMinutes", "min"], ["rpe", "RPE"], ["heartRateBpm", "bpm"]] as const) {
          if (a.s[field] !== undefined && b.s[field] !== undefined) r.fact(`sessions:${field}:delta`, `${field} · 최근 - 이전 기록`, a.s[field]! - b.s[field]!, unit, field === "durationMinutes" ? "DIRECT" : "M19", [r.sessionRef(b.s, b.source), r.sessionRef(a.s, a.source)])
        }
      }
      r.text("전달된 기록 중 최근 두 세션을 읽었어요. 운동 형태가 같아도 조건·회복·체감은 다를 수 있으며, 기록 차이는 훈련 효과나 향상 원인의 증명이 아니에요.")
      break
    }
    case "G04": preferenceHistory(r, false); break
    case "G05": {
      const data = r.training(); const last = data?.sessions.at(-1)
      if (last) { sessionDetail(r, last); r.fact("last:date", "전달된 범위의 마지막 운동 날짜", last.date, "date", "DIRECT", [r.sessionRef(last)]) }
      r.text("마지막 기록은 당시의 사실이에요. 그 뒤의 공백이 활동 중단이었다고 확정하지 않으며 현재 상태와 현재 계획은 별도로 확인해야 해요.")
      break
    }
    case "G06": {
      const data = r.training(); if (data) r.totals(data)
      if (r.input.planActual) planReading(r, data)
      r.text("해당 기간에서 확인한 거리·운동 날짜·목적 구성·계획 비교만 모았어요. 자료가 없는 항목을 채워 사실 수를 성취 점수로 만들지 않아요.")
      break
    }
    case "D02": case "D03": case "D04": case "D05": case "D07": case "D08": case "F03":
    case "H01": case "H02": case "H03": case "H04": case "H05": case "H06": break
    default: throw new RangeError(`Unsupported Oracle topic: ${topicId}`)
  }
}

/** Pure, bounded reading of passed structured evidence. No fetch, memo, storage or plan writes.
 * Omitted sources mean known missing; adapters must explicitly pass UNAVAILABLE on failed reads.
 * REVOKED invalidates the whole dependent reading, even if a stale READY payload is also present.
 */
export function resolveOracleContentReading(topicId: string, input: OracleContentReaderInput): OracleContentReading {
  const topic = oracleContentTopic(topicId)
  if (!topic) throw new RangeError(`Unknown Oracle topic: ${topicId}`)
  const r = new Reader(input)
  const educational = education[topicId]
  if (educational) educational.forEach(p => r.text(p))
  if (!isValidIsoDate(input.today)) { r.result.states.today = "UNAVAILABLE"; r.need("today:valid-local-date", false) }
  else readTopic(r, topicId)
  const { states, missing, versions } = r.result
  const revoked = Object.values(states).includes("REVOKED")
  const unavailable = Object.values(states).includes("UNAVAILABLE")
  const facts = revoked ? [] : r.result.facts
  const hasFacts = facts.length > 0
  const status: OracleReadingStatus = revoked ? "REVOKED" : unavailable && !hasFacts ? "UNAVAILABLE"
    : hasFacts ? missing.size || unavailable ? "PARTIAL" : "SUFFICIENT"
    : educational && missing.size === 0 ? "SUFFICIENT" : "MISSING"
  const paragraphs = revoked ? [...(educational ?? []), "이 풀이에 필요한 자료가 철회되어 개인 사실과 파생 비교를 표시하지 않아요."]
    : [topic.explanation, ...r.result.paragraphs]
  if (!revoked && status === "UNAVAILABLE") paragraphs.push("자료를 아직 받지 못했거나 형식·버전을 확인할 수 없어요. 기록이 없다는 뜻은 아니에요.")
  if (!revoked && status === "MISSING") paragraphs.push("이 주제의 개인 사실을 읽을 입력이 아직 없어요. 위 설명은 일반 해설이며 개인 결과가 아니에요.")
  if (!revoked && status === "PARTIAL") paragraphs.push("확인된 사실만 표시했어요. 빠진 자료나 미수신 범위가 있어 전체 결과로 읽지 않아요.")
  return {
    topicId, title: topic.title, kind: topic.kind, status, personalized: topic.kind !== "EDUCATION" && hasFacts,
    readerVersion: ORACLE_CONTENT_READER_VERSION, contentVersion: topic.version,
    sourceVersions: revoked ? {} : { ...versions }, inputStates: { ...states }, facts,
    paragraphs, limitations: [topic.limitation], missingInputs: [...missing].sort(), nextAction: topic.destination,
  }
}

export const buildOracleContentReading = resolveOracleContentReading
