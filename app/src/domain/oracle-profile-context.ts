import { z } from "zod"
import { isValidIsoDate } from "./dates"

const goal = z.enum(["RECORD", "FINISH", "EXPERIENCE", "RANK", "QUALIFY", "REFRESH", "ROUTINE", "LEARN"])
const choices = <T extends z.ZodType>(schema: T, max: number) => z.array(schema).max(max).refine(items => new Set(items).size === items.length)
const date = z.string().refine(isValidIsoDate)
const opaque = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/u)
export const oracleContextAnswersSchema = z.object({
  motivations: choices(goal, 8).optional(),
  movementForm: z.enum(["CONTINUOUS", "INTERVAL", "BOTH"]).optional(),
  company: z.enum(["ALONE", "TOGETHER", "BOTH"]).optional(),
  conversation: z.enum(["QUIET", "TALK", "EITHER"]).optional(),
  familiarEnjoyment: z.enum(["YES", "NO", "VARIES", "UNKNOWN"]).optional(),
  learningInterests: choices(z.enum(["RUN", "WEIGHTS", "JUMPS", "CYCLING", "SUPPLEMENTARY", "METHODS", "RACES"]), 7).optional(),
  supplementaryExperience: z.enum(["YES", "NO", "UNKNOWN"]).optional(),
  supplementaryInterest: z.enum(["YES", "NO", "UNKNOWN"]).optional(),
  raceGoals: choices(goal, 8).optional(), raceOutcomes: choices(goal, 8).optional(), todayGoals: choices(goal, 8).optional(),
  togetherPhases: choices(z.enum(["WARMUP", "MAIN", "RECOVERY", "COOLDOWN"]), 4).optional(),
  context: z.enum(["SEASON", "TEAM", "STUDY", "WORK", "OTHER", "UNKNOWN"]).optional(),
}).strict()
export const oracleContextConditionsSchema = z.object({
  availableMinutes: z.number().finite().min(0).max(1440).optional(),
  places: choices(z.enum(["TRACK", "ROAD", "TRAIL", "HILL", "GYM", "INDOOR"]), 6).optional(),
  equipment: choices(z.enum(["NONE", "WEIGHTS", "BIKE", "TREADMILL"]), 4).optional(),
  meetingWindows: z.array(z.object({ date, startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) }).strict().refine(w => w.startMinute < w.endMinute)).max(20).optional(),
  races: z.array(z.object({ recordId: opaque, course: z.enum(["TRACK", "ROAD", "TRAIL", "HILLY"]).optional(), weather: z.enum(["DRY", "RAIN", "WIND", "HEAT", "COLD"]).optional(), round: z.enum(["HEAT", "SEMIFINAL", "FINAL", "TIMED"]).optional(), goal: goal.optional() }).strict()).max(50).optional(),
  events: z.array(z.object({ id: opaque, date, travelMinutes: z.number().finite().min(0).max(10080).optional(), cost: z.object({ amount: z.number().finite().nonnegative(), currency: z.enum(["KRW", "USD", "EUR", "JPY", "GBP"]) }).strict().optional() }).strict()).max(50).optional(),
}).strict().superRefine((value, context) => {
  if (value.equipment?.includes("NONE") && value.equipment.length > 1) context.addIssue({ code: "custom", path: ["equipment"], message: "NONE cannot be combined with equipment." })
  for (const [field, keys] of [
    ["races", value.races?.map(item => item.recordId)],
    ["events", value.events?.map(item => item.id)],
    ["meetingWindows", value.meetingWindows?.map(item => `${item.date}:${item.startMinute}:${item.endMinute}`)],
  ] as const) {
    if (keys && new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: [field], message: "Duplicate context identity." })
  }
})
export const oracleProfileContextSchema = z.object({
  version: z.literal("ORACLE_CONTEXT_V1"), answeredAt: z.iso.datetime(),
  answers: oracleContextAnswersSchema, conditions: oracleContextConditionsSchema,
}).strict()
export type OracleProfileContext = z.infer<typeof oracleProfileContextSchema>
export type OracleContextAnswers = z.infer<typeof oracleContextAnswersSchema>

const goalOptions = [["RECORD", "목표 기록"], ["FINISH", "완주"], ["EXPERIENCE", "새 경험"], ["RANK", "순위"], ["QUALIFY", "예선 통과"], ["REFRESH", "기분 전환"], ["ROUTINE", "꾸준한 일상"], ["LEARN", "배움"]] as const
export const ORACLE_CONTEXT_QUESTIONS = [
  { id: "motivations", title: "어떤 이유로 달리나요?", multiple: true, options: goalOptions },
  { id: "movementForm", title: "어떤 달리기 방식이 더 좋은가요?", multiple: false, options: [["CONTINUOUS", "멈추지 않고 이어 달리기"], ["INTERVAL", "쉬었다 반복해서 달리기"], ["BOTH", "둘 다 좋아요"]] },
  { id: "company", title: "누구와 달리는 게 좋은가요?", multiple: false, options: [["ALONE", "혼자"], ["TOGETHER", "함께"], ["BOTH", "둘 다 좋아요"]] },
  { id: "conversation", title: "함께 달릴 때는?", multiple: false, options: [["QUIET", "조용히 달리는 편이 좋아요"], ["TALK", "이야기하며 달리고 싶어요"], ["EITHER", "어느 쪽도 괜찮아요"]] },
  { id: "familiarEnjoyment", title: "익숙한 코스나 훈련도 즐거운가요?", multiple: false, options: [["YES", "네"], ["NO", "새로운 쪽이 좋아요"], ["VARIES", "상황마다 달라요"], ["UNKNOWN", "아직 모르겠어요"]] },
  { id: "learningInterests", title: "더 알아보고 싶은 것은?", multiple: true, options: [["RUN", "달리기"], ["WEIGHTS", "웨이트"], ["JUMPS", "점프 훈련"], ["CYCLING", "자전거"], ["SUPPLEMENTARY", "보조 운동"], ["METHODS", "훈련법"], ["RACES", "대회"]] },
  { id: "supplementaryExperience", title: "보조 운동을 해본 적이 있나요?", multiple: false, options: [["YES", "있어요"], ["NO", "없어요"], ["UNKNOWN", "아직 잘 모르겠어요"]] },
  { id: "supplementaryInterest", title: "보조 운동을 해보고 싶은가요?", multiple: false, options: [["YES", "관심 있어요"], ["NO", "지금은 아니에요"], ["UNKNOWN", "아직 모르겠어요"]] },
  { id: "raceGoals", title: "이번 대회에서 중요한 것은?", multiple: true, options: goalOptions },
  { id: "raceOutcomes", title: "대회에서 직접 이뤘다고 느낀 것은?", multiple: true, options: goalOptions },
  { id: "todayGoals", title: "오늘 함께 달리는 목적은?", multiple: true, options: goalOptions },
  { id: "togetherPhases", title: "어느 구간을 함께하고 싶은가요?", multiple: true, options: [["WARMUP", "준비 운동"], ["MAIN", "본운동"], ["RECOVERY", "반복 사이 회복"], ["COOLDOWN", "정리 운동"]] },
  { id: "context", title: "지금의 생활에서 고려할 것은?", multiple: false, options: [["SEASON", "대회 시즌"], ["TEAM", "팀 일정"], ["STUDY", "학업"], ["WORK", "일"], ["OTHER", "그 밖의 일정"], ["UNKNOWN", "따로 정하지 않아요"]] },
] as const
