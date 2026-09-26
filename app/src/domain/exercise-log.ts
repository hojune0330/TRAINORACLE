import { z } from "zod"

export const EXERCISE_KINDS = {
  RUNNING: "달리기", INTERVALS: "반복 달리기", STRENGTH: "근력 운동",
  PLYOMETRIC: "점프·플라이오", CROSS_TRAINING: "자전거·수영 등", OTHER: "다른 운동",
} as const
export const exerciseKindSchema = z.enum(["RUNNING", "INTERVALS", "STRENGTH", "PLYOMETRIC", "CROSS_TRAINING", "OTHER"])
const positive = z.number().finite().positive().max(1_000_000)
const count = positive.int()
export const recoveryRecordSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z.object({ kind: z.literal("TIMED"), seconds: z.number().finite().min(0).max(86400) }).strict(),
])
export const exerciseRowSchema = z.object({
  id: z.string().min(1).max(100),
  distanceM: positive.optional(), durationSeconds: positive.optional(),
  repetitions: count.optional(), sets: count.optional(),
  loadKg: z.number().finite().min(0).max(10000).optional(), contacts: count.optional(),
  side: z.enum(["LEFT", "RIGHT", "BOTH"]).optional(),
  recovery: recoveryRecordSchema.optional(), setRecovery: recoveryRecordSchema.optional(),
}).strict()
export const exerciseComponentSchema = z.object({
  id: z.string().min(1).max(100), kind: exerciseKindSchema,
  name: z.string().max(80), rows: z.array(exerciseRowSchema).max(64),
}).strict().refine(value => new Set(value.rows.map(row => row.id)).size === value.rows.length, "Duplicate row IDs")
export const exerciseLogSchema = z.object({
  version: z.literal(1), source: z.literal("SELF_REPORTED"),
  components: z.array(exerciseComponentSchema).max(24),
}).strict().refine(value => new Set(value.components.map(item => item.id)).size === value.components.length, "Duplicate component IDs")
export type ExerciseComponent = z.infer<typeof exerciseComponentSchema>
export type ExerciseRow = z.infer<typeof exerciseRowSchema>
export type ExerciseLog = z.infer<typeof exerciseLogSchema>

export function describeExerciseRow(row: ExerciseRow): string {
  const recovery = (value: ExerciseRow["recovery"]) => value?.kind === "NONE" ? "없음" : value?.kind === "TIMED" ? `${value.seconds}초` : null
  return [row.distanceM !== undefined ? `${row.distanceM}m` : null,
    row.durationSeconds !== undefined ? `${row.durationSeconds}초` : null,
    row.loadKg !== undefined ? `${row.loadKg}kg` : null,
    row.repetitions !== undefined ? row.sets !== undefined ? `${row.repetitions}회 × ${row.sets}세트` : `${row.repetitions}회` : null,
    row.sets !== undefined && row.repetitions === undefined ? `${row.sets}세트` : null,
    row.contacts !== undefined ? `${row.contacts}접지` : null,
    row.side ? ({ LEFT: "왼쪽", RIGHT: "오른쪽", BOTH: "양쪽" } as const)[row.side] : null,
    row.recovery ? `반복 사이 ${recovery(row.recovery)}` : null,
    row.setRecovery ? `세트 사이 ${recovery(row.setRecovery)}` : null,
  ].filter(Boolean).join(" · ") || "종류만 기록"
}

export function cloneExercise(item: ExerciseComponent): ExerciseComponent {
  return { ...item, id: crypto.randomUUID(), rows: item.rows.map(row => ({ ...row, id: crypto.randomUUID(),
    ...(row.recovery ? { recovery: { ...row.recovery } } : {}),
    ...(row.setRecovery ? { setRecovery: { ...row.setRecovery } } : {}),
  })) }
}
