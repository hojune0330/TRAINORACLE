import { z } from "zod"
import { parseAthleteRecord, type AthleteRecord } from "./athlete-records"
import { isValidIsoDate } from "./dates"
import { oracleProfileRevisionSchema, type OracleProfileRevision } from "./oracle-profile-snapshot"
import {
  buildOracleContentReading, type OracleContentReading, type OracleContentReaderInput,
  type OracleReaderSource, type OracleReadingFact,
} from "./oracle-content-reader"

export const ORACLE_FRIEND_FIELDS = [
  { id: "PROFILE", label: "러닝 프로필 응답" },
  { id: "RECORDS", label: "실제 경기 기록" },
  { id: "GOALS", label: "당일 목표" },
  { id: "PHASES", label: "함께할 구간" },
  { id: "TIME", label: "가능한 시간" },
  { id: "TRAINING", label: "선택 기간의 훈련" },
] as const
export type OracleFriendField = typeof ORACLE_FRIEND_FIELDS[number]["id"]
export const ORACLE_FRIEND_TOPICS = ["E01", "E02", "E03", "E04", "E05", "E06"] as const
export type OracleFriendTopic = typeof ORACLE_FRIEND_TOPICS[number]

export const ORACLE_FRIEND_GOALS = ["RECORD", "FINISH", "EXPERIENCE", "RANK", "QUALIFY", "REFRESH", "ROUTINE", "LEARN"] as const
export const ORACLE_FRIEND_PHASES = ["WARMUP", "MAIN", "RECOVERY", "COOLDOWN"] as const
const date = z.string().refine(isValidIsoDate)
const goals = z.array(z.enum(ORACLE_FRIEND_GOALS))
const phases = z.array(z.enum(ORACLE_FRIEND_PHASES))
const windows = z.array(z.object({ date, startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) })
  .strict().refine(w => w.startMinute < w.endMinute))
const training = z.object({
  period: z.object({ startDate: date, endDate: date }).strict().refine(p => p.startDate <= p.endDate),
  coverage: z.enum(["COMPLETE", "PARTIAL"]),
  sessions: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9._:-]+$/u).max(128), date,
    provenance: z.literal("EXPLICIT"), activity: z.literal("RUN"),
    distanceKm: z.number().finite().nonnegative().optional(),
    purpose: z.enum(["BASE", "REC", "LT", "VO2", "GLY", "SPEED", "ATP_PC", "MIX", "OTHER"]).optional(),
  }).strict()),
}).strict().refine(t => t.sessions.every(s => s.date >= t.period.startDate && s.date <= t.period.endDate))

/** Deliberately smaller than the reader input: no memo, identity, location or journal objects. */
const manualSchema = z.object({
  profile: oracleProfileRevisionSchema.optional(), records: z.array(z.unknown()).optional(),
  goals: goals.optional(), phases: phases.optional(), windows: windows.optional(), training: training.optional(),
}).strict()
export type OracleFriendManualData = {
  profile?: OracleProfileRevision; records?: readonly AthleteRecord[]
  goals?: z.infer<typeof goals>; phases?: z.infer<typeof phases>
  windows?: z.infer<typeof windows>; training?: z.infer<typeof training>
}
export type OracleFriendSelf = Omit<OracleFriendManualData, "profile" | "records"> & {
  /** null means unavailable or absent, never an empty successfully received record set. */
  profile: OracleProfileRevision | null; records: readonly AthleteRecord[] | null
}
const fieldKeys = { PROFILE: "profile", RECORDS: "records", GOALS: "goals", PHASES: "phases", TIME: "windows", TRAINING: "training" } as const
const ready = <T,>(data: T, sourceVersion: string): OracleReaderSource<T> => ({ state: "READY", sourceVersion, data })

function subset(data: OracleFriendManualData, fields: readonly OracleFriendField[]): OracleFriendManualData {
  return Object.fromEntries(fields.flatMap(field => {
    const key = fieldKeys[field]
    return data[key] === undefined ? [] : [[key, structuredClone(data[key])]]
  })) as OracleFriendManualData
}

function readerSources(data: OracleFriendManualData, version: string) {
  // Explicit missing sources prevent reader default arguments from substituting self data.
  const missing = { state: "MISSING" } as const
  return {
    profile: data.profile ? ready(data.profile, `${version}:profile:${data.profile.revision}`) : missing,
    records: data.records ? ready(data.records, `${version}:records`) : missing,
    answers: data.goals !== undefined || data.phases !== undefined
      ? ready({ todayGoals: data.goals, togetherPhases: data.phases }, `${version}:answers`) : missing,
    conditions: data.windows ? ready({ meetingWindows: data.windows }, `${version}:conditions`) : missing,
    training: data.training ? ready(data.training, `${version}:training`) : missing,
  }
}

export function formatOracleFriendFact(fact: OracleReadingFact): string {
  const unit = ({ count: "개", days: "일", s: "초", min: "분", "s/200m": "초/200m", "s/400m": "초/400m", "s/km": "초/km", index: "점", answer: "", category: "", date: "" } as Record<string, string>)[fact.unit] ?? fact.unit
  const value = typeof fact.value === "number" ? Number(fact.value.toFixed(4)) : fact.value
  const denominator = fact.denominator === undefined ? ""
    : fact.unit === "index" ? (fact.metric === "M01" ? ` (${fact.denominator}점 만점)` : ` (기준 ${fact.denominator})`)
    : ` (${fact.metric === "M17" ? "비교 가능한" : "기준 기록"} ${fact.denominator}개)`
  const period = fact.period ? ` · ${fact.period.startDate}~${fact.period.endDate}` : ""
  return `${value}${unit ? ` ${unit}` : ""}${denominator}${period}`
}

export function oracleFriendFactLabel(fact: OracleReadingFact): string {
  const purposes: Record<string, string> = { BASE: "기초 지구력", REC: "회복", LT: "역치", VO2: "최대산소섭취", GLY: "해당", SPEED: "스피드", ATP_PC: "순발력", MIX: "혼합", OTHER: "기타" }
  return Object.entries(purposes).find(([key]) => fact.label === `${key} 목적`)?.[1] ?? fact.label
}

/** Memory-only manual permission, NOT a server grant. No fetch, storage, clipboard or downloads.
 * The parent must unmount on account changes; server-backed friendship is intentionally absent.
 * Read/export recompute from current permissions, never from a caller-supplied cached reading.
 */
export function createOracleFriendComparisonSession() {
  let allowed = false
  let selected: OracleFriendField[] = []
  let peer: OracleFriendManualData = {}
  let external = false
  let shareFields: OracleFriendField[] = []
  let shareScope: string | null = null
  let revision = 0
  const invalidateShare = () => { external = false; shareFields = []; shareScope = null }
  const revoke = () => { allowed = false; selected = []; peer = {}; invalidateShare(); revision++ }
  const source = (self: OracleFriendSelf, today: string, fields: readonly OracleFriendField[]): OracleContentReaderInput => {
    const own = subset({ ...self, profile: self.profile ?? undefined, records: self.records ?? undefined }, fields)
    const input: OracleContentReaderInput = {
      today, ...readerSources(own, "manual-self"),
      friend: allowed ? ready({ permission: "COMPARISON_ALLOWED", ...readerSources(subset(peer, fields), `manual-friend:${revision}`) }, `manual-permission:${revision}`) : { state: "REVOKED" },
    }
    return { ...input,
      profile: fields.includes("PROFILE") && self.profile === null ? { state: "UNAVAILABLE" } : input.profile,
      records: fields.includes("RECORDS") && self.records === null ? { state: "UNAVAILABLE" } : input.records,
    }
  }
  return {
    grantComparison() { allowed = true },
    revoke,
    close: revoke,
    snapshot() { return { comparisonAllowed: allowed, fields: [...selected], peer: structuredClone(peer), externalShareAllowed: external, shareFields: [...shareFields] } },
    selectFields(fields: readonly OracleFriendField[]) {
      if (!allowed || fields.some(f => !ORACLE_FRIEND_FIELDS.some(option => option.id === f))) return false
      selected = [...new Set(fields)]; peer = subset(peer, selected); invalidateShare(); revision++
      return true
    },
    replacePeer(input: unknown, today: string) {
      if (!allowed) return false
      // Clear before validation so a failed replacement cannot leave a stale successful result.
      peer = {}; invalidateShare(); revision++
      if (!isValidIsoDate(today)) return false
      const parsed = manualSchema.safeParse(input)
      if (!parsed.success) return false
      const records = parsed.data.records?.map(record => parseAthleteRecord(record, new Date(`${today}T12:00:00`)))
      if (records?.some(record => !record || record.purpose === "RACE_GOAL" || record.enteredBy !== "ATHLETE" || record.verificationState !== "SELF_REPORTED")) return false
      if (parsed.data.training?.sessions.some(s => s.date > today)) return false
      peer = subset({ ...parsed.data, records: records as AthleteRecord[] | undefined }, selected)
      return true
    },
    setExternalShare(permission: boolean, fields: readonly OracleFriendField[], self?: OracleFriendSelf, today?: string) {
      invalidateShare()
      if (!allowed || permission !== true || !self || !today || !isValidIsoDate(today) || fields.length === 0 || fields.some(f => !selected.includes(f))) return false
      external = true; shareFields = [...new Set(fields)]; shareScope = JSON.stringify(source(self, today, shareFields)); return true
    },
    read(topic: OracleFriendTopic, self: OracleFriendSelf, today: string): OracleContentReading | null {
      if (!allowed) return null
      const input = source(self, today, selected)
      const shareCurrent = external && shareScope === JSON.stringify(source(self, today, shareFields))
      return buildOracleContentReading(topic, topic === "E06" ? { ...input, share: shareCurrent ? ready({ permission: "EXTERNAL_SHARE_ALLOWED", selectedFields: [...new Set(shareFields.map(f => f === "RECORDS" ? "RACE_RECORDS" as const : f === "TRAINING" ? "TRAINING" as const : "ANSWERS" as const))] }, `manual-share:${revision}`) : { state: "REVOKED" } } : input)
    },
    exportPreview(self: OracleFriendSelf, today: string): string | null {
      if (!allowed || !external || shareFields.length === 0 || shareFields.some(f => !selected.includes(f))) return null
      const input = source(self, today, shareFields)
      if (shareScope !== JSON.stringify(input)) return null
      const facts = new Map<string, OracleReadingFact>()
      for (const topic of ORACLE_FRIEND_TOPICS.filter(t => t !== "E06")) {
        const result = buildOracleContentReading(topic, input)
        if (result.status === "REVOKED" || result.status === "UNAVAILABLE") continue
        for (const fact of result.facts) facts.set(fact.id, fact)
      }
      if (!facts.size) return null
      return ["오라클 · 허용된 사실", "직접 입력한 자료의 비교이며 관계 궁합·능력 순위·공동 훈련 처방이 아닙니다.",
        ...[...facts.values()].map(f => `${f.owner === "FRIEND" ? "친구" : f.owner === "SELF" ? "나" : "비교"} · ${oracleFriendFactLabel(f)}: ${formatOracleFriendFact(f)}`),
        "수동 동의 확인이며 서버 접근 권한이 아닙니다. 이미 외부에 복사한 내용은 회수할 수 없습니다.",
      ].join("\n")
    },
  }
}
