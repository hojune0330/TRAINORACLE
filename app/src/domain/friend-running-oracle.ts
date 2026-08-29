import { z } from "zod"
import { buildEnergySystemLedger, energyLedgerWindow } from "./energy-system-ledger"
import { ENERGY_SYSTEM_KEYS, ENERGY_SYSTEM_META } from "./energy-system-taxonomy"
import type { EnergySystemKey } from "./energy-system-taxonomy"
import type { AthleteRecord } from "./athlete-records"
import type { StructuredJournalObservation } from "./journal-observation"

export const FRIEND_RUNNING_ORACLE_VERSION = "FRIEND_RUNNING_ORACLE_V1" as const

const energyCountSchema = z.object({
  key: z.enum(ENERGY_SYSTEM_KEYS),
  count: z.number().int().nonnegative(),
}).strict()

export const oracleComparisonSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  sharedFields: z.array(z.enum(["BEST_RECORD", "RECENT_DISTANCE", "ENERGY_HISTORY"])).max(3),
  record: z.object({
    eventDistanceM: z.number().int().min(60),
    bestSeconds: z.number().positive(),
  }).strict().nullable(),
  recent8WeekDistanceKm: z.number().nonnegative().nullable(),
  structuredSessionCount: z.number().int().nonnegative().nullable(),
  energySessionCounts: z.array(energyCountSchema).max(ENERGY_SYSTEM_KEYS.length),
}).strict().superRefine((snapshot, context) => {
  const shared = new Set(snapshot.sharedFields)
  if (shared.size !== snapshot.sharedFields.length) {
    context.addIssue({ code: "custom", path: ["sharedFields"], message: "shared fields must be unique" })
  }
  if (shared.has("BEST_RECORD") !== (snapshot.record !== null)) {
    context.addIssue({ code: "custom", path: ["record"], message: "record consent and payload must match" })
  }
  if (shared.has("RECENT_DISTANCE") !== (snapshot.recent8WeekDistanceKm !== null)) {
    context.addIssue({ code: "custom", path: ["recent8WeekDistanceKm"], message: "distance consent and payload must match" })
  }
  if (shared.has("ENERGY_HISTORY") !== (snapshot.energySessionCounts.length > 0 || snapshot.structuredSessionCount !== null)) {
    context.addIssue({ code: "custom", path: ["energySessionCounts"], message: "energy consent and payload must match" })
  }
})

export type OracleComparisonSnapshot = z.infer<typeof oracleComparisonSnapshotSchema>

export type OracleSnapshotSelection = {
  readonly recordId: string | null
  readonly shareRecord: boolean
  readonly shareDistance: boolean
  readonly shareEnergy: boolean
}

export type FriendRunningOracle = {
  readonly version: typeof FRIEND_RUNNING_ORACLE_VERSION
  readonly headline: string
  readonly facts: readonly string[]
  readonly togetherPlan: readonly string[]
  readonly unknowns: readonly string[]
}

export function buildOracleComparisonSnapshot({
  observations,
  records,
  selection,
  today,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly records: readonly AthleteRecord[]
  readonly selection: OracleSnapshotSelection
  readonly today: string
}): OracleComparisonSnapshot | null {
  const sharedFields: OracleComparisonSnapshot["sharedFields"][number][] = []
  const selectedRecord = selection.shareRecord
    ? records.find((record) => record.id === selection.recordId && record.purpose !== "RACE_GOAL") ?? null
    : null
  if (selection.shareRecord && selectedRecord !== null) sharedFields.push("BEST_RECORD")

  const ledger = buildEnergySystemLedger(observations, energyLedgerWindow("RECENT_8_WEEKS", today))
  const recent8WeekDistanceKm = selection.shareDistance
    ? round1(ledger.rows.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0))
    : null
  if (selection.shareDistance) sharedFields.push("RECENT_DISTANCE")

  const energySessionCounts = selection.shareEnergy
    ? ledger.rows
      .filter((row) => row.journalSessionCount > 0)
      .map((row) => ({ key: row.key, count: row.journalSessionCount }))
    : []
  const structuredSessionCount = selection.shareEnergy ? ledger.includedSourceCount : null
  if (selection.shareEnergy) sharedFields.push("ENERGY_HISTORY")

  if (sharedFields.length === 0) return null
  return oracleComparisonSnapshotSchema.parse({
    schemaVersion: 1,
    sharedFields,
    record: selectedRecord === null ? null : {
      eventDistanceM: selectedRecord.eventDistanceM,
      bestSeconds: selectedRecord.performanceSeconds,
    },
    recent8WeekDistanceKm,
    structuredSessionCount,
    energySessionCounts,
  })
}

export function deriveFriendRunningOracle(
  own: OracleComparisonSnapshot,
  friend: OracleComparisonSnapshot,
): FriendRunningOracle {
  const facts: string[] = []
  const unknowns: string[] = []
  const togetherPlan = [
    "준비 운동과 정리 운동은 대화 가능한 속도로 함께 진행해요.",
    "본운동은 같은 절대 페이스를 강요하지 않고, 각자의 기록과 RPE 기준을 따라요.",
    "시간 기준 반복을 사용하고 회복 구간에서 다시 모이면 수준 차이가 있어도 함께할 수 있어요.",
  ]

  if (own.record !== null && friend.record !== null && own.record.eventDistanceM === friend.record.eventDistanceM) {
    const gap = Math.abs(own.record.bestSeconds - friend.record.bestSeconds)
      / Math.max(own.record.bestSeconds, friend.record.bestSeconds) * 100
    facts.push(`${own.record.eventDistanceM}m 기록 차이는 ${round1(gap)}%예요. 빠르기 순위가 아니라 함께 달릴 방법을 정하는 참고값이에요.`)
  } else {
    unknowns.push("같은 종목의 공개 기록이 없어 절대 페이스는 비교하지 않았어요.")
  }

  if (own.recent8WeekDistanceKm !== null && friend.recent8WeekDistanceKm !== null) {
    facts.push(`최근 8주 공개 거리: 나 ${own.recent8WeekDistanceKm}km · 친구 ${friend.recent8WeekDistanceKm}km`)
  } else {
    unknowns.push("두 사람 모두 최근 8주 거리를 공개한 경우에만 거리 흐름을 나란히 보여줘요.")
  }

  const ownTop = mostFrequentSystems(own.energySessionCounts)
  const friendTop = mostFrequentSystems(friend.energySessionCounts)
  if (ownTop.length > 0 && friendTop.length > 0) {
    facts.push(`자주 기록한 훈련: 나 ${labels(ownTop)} · 친구 ${labels(friendTop)}. 강점·약점 판정은 아니에요.`)
  } else {
    unknowns.push("에너지 시스템은 두 사람 모두 직접 선택한 기록이 있을 때만 비교해요.")
  }

  return {
    version: FRIEND_RUNNING_ORACLE_VERSION,
    headline: facts.length === 0
      ? "지금은 함께 달릴 기본 원칙만 보여드려요"
      : "공개하기로 고른 기록만 나란히 봤어요",
    facts,
    togetherPlan,
    unknowns,
  }
}

function mostFrequentSystems(
  rows: readonly { readonly key: EnergySystemKey; readonly count: number }[],
): readonly EnergySystemKey[] {
  if (rows.length === 0) return []
  const maximum = Math.max(...rows.map((row) => row.count))
  return rows.filter((row) => row.count === maximum).map((row) => row.key)
}

function labels(keys: readonly EnergySystemKey[]): string {
  return keys.map((key) => `${ENERGY_SYSTEM_META[key].code} ${ENERGY_SYSTEM_META[key].shortLabel}`).join(" · ")
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}
