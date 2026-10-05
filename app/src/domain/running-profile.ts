import { z } from "zod"

export const RUNNING_PROFILE_VERSION = "RUNNING_PROFILE_V1" as const
export const PROFILE_QUESTION_IDS = ["motives", "intensity", "company", "routine", "race", "events", "supplement", "weights", "constraints"] as const
export type ProfileQuestionId = typeof PROFILE_QUESTION_IDS[number]
export type ProfileQuestion = {
  readonly id: ProfileQuestionId
  readonly title: string
  readonly label: string
  readonly multiple: boolean
  readonly options: readonly { readonly id: string; readonly label: string }[]
}
const options = (values: readonly (readonly [string, string])[]) => values.map(([id, label]) => ({ id, label }))
export const PROFILE_QUESTIONS: readonly ProfileQuestion[] = [
  { id: "motives", label: "달리는 이유", title: "무엇 때문에 달리고 싶나요?", multiple: true, options: options([
    ["record", "기록에 도전"], ["health", "건강과 체력"], ["refresh", "기분 전환"], ["friends", "사람들과 교류"], ["explore", "새로운 코스"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "intensity", label: "강도 선호", title: "어떤 강도로 달리는 게 좋나요?", multiple: false, options: options([
    ["easy", "대화할 수 있는 강도"], ["hard", "숨이 차는 강도"], ["varies", "둘 다 · 그때그때 달라요"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "company", label: "함께하는 방식", title: "누구와 달리는 게 좋나요?", multiple: false, options: options([
    ["solo", "혼자"], ["together", "친구나 크루와"], ["both", "둘 다 좋아요"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "routine", label: "진행 방식", title: "어떻게 달릴 때 편한가요?", multiple: false, options: options([
    ["planned", "정해 둔 계획대로"], ["flexible", "그날 상황에 맞춰"], ["both", "계획과 자유롭게 달리기를 섞어서"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "race", label: "대회에서 원하는 것", title: "대회에서 무엇을 얻고 싶나요?", multiple: true, options: options([
    ["pb", "내 기록 경신"], ["finish", "목표 거리 완주"], ["competition", "순위 경쟁"], ["experience", "대회 분위기와 경험"], ["none", "지금은 대회 생각이 없어요"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "events", label: "관심 종목", title: "어떤 거리가 끌리나요?", multiple: true, options: options([
    ["800", "800m"], ["1500", "1500m"], ["3000", "3000m"], ["5000", "5km"], ["10000", "10km"], ["half", "하프"], ["marathon", "마라톤"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "supplement", label: "보조운동 선호", title: "함께 하고 싶은 운동은?", multiple: true, options: options([
    ["mobility", "가동성 · 스트레칭"], ["core", "코어 운동"], ["jump", "점프 · 플라이오"], ["cross", "자전거 · 수영"], ["none", "지금은 달리기만"], ["unknown", "아직 모르겠어요"],
  ]) },
  { id: "weights", label: "웨이트 선호", title: "어떤 근력 운동이 끌리나요?", multiple: true, options: options([
    ["bodyweight", "맨몸 운동"], ["equipment", "덤벨 · 머신 · 바벨"], ["guided", "지도받으며 배우기"], ["none", "지금은 하고 싶지 않아요"], ["unknown", "경험이 없어 아직 몰라요"],
  ]) },
  { id: "constraints", label: "현실적인 여건", title: "운동할 때 고려할 여건은?", multiple: true, options: options([
    ["time", "시간이 부족해요"], ["equipment", "장소나 장비가 부족해요"], ["guidance", "방법을 배우고 싶어요"], ["schedule", "일정이 자주 바뀌어요"], ["none", "특별한 제약은 없어요"], ["unknown", "아직 모르겠어요"],
  ]) },
]

export type RunningProfileAnswers = Partial<Record<ProfileQuestionId, string[]>>
const exclusive = (value: string) => value === "unknown" || value === "none"
const answerSchema = (id: ProfileQuestionId) => {
  const question = PROFILE_QUESTIONS.find(item => item.id === id)!
  return z.array(z.string()).max(question.multiple ? question.options.length : 1).refine(values =>
    new Set(values).size === values.length && values.every(value => question.options.some(option => option.id === value))
    && (!values.some(exclusive) || values.length === 1), "Invalid profile selection").optional()
}
export const runningProfileAnswersSchema = z.object({
  motives: answerSchema("motives"), intensity: answerSchema("intensity"), company: answerSchema("company"),
  routine: answerSchema("routine"), race: answerSchema("race"), events: answerSchema("events"),
  supplement: answerSchema("supplement"), weights: answerSchema("weights"), constraints: answerSchema("constraints"),
}).strict()

export function toggleProfileAnswer(answers: RunningProfileAnswers, id: ProfileQuestionId, value: string): RunningProfileAnswers {
  const question = PROFILE_QUESTIONS.find(item => item.id === id)
  if (!question?.options.some(option => option.id === value)) return answers
  const before = answers[id] ?? []
  const values = !question.multiple || exclusive(value) ? [value]
    : before.includes(value) ? before.filter(item => item !== value) : [...before.filter(item => !exclusive(item)), value]
  // Catalog order, not tap order, determines the explanation and persisted representation.
  return { ...answers, [id]: question.options.filter(option => values.includes(option.id)).map(option => option.id) }
}

export function describeRunningPreferences(input: unknown) {
  const parsed = runningProfileAnswersSchema.safeParse(input)
  const answers: RunningProfileAnswers = parsed.success ? parsed.data : {}
  const rows = PROFILE_QUESTIONS.map(question => {
    const values = answers[question.id] ?? []
    return { id: question.id, label: question.label,
      status: values.length === 0 ? "UNANSWERED" as const : values.includes("unknown") ? "UNKNOWN" as const : "ANSWERED" as const,
      text: values.length === 0 ? "아직 고르지 않았어요" : question.options.filter(option => values.includes(option.id)).map(option => option.label).join(" · ") }
  })
  const meaningful = rows.filter(row => row.status === "ANSWERED")
  const summary = meaningful.slice(0, 2).map(row => {
    const selected = PROFILE_QUESTIONS.find(question => question.id === row.id)!.options.filter(option => answers[row.id]?.includes(option.id))
    return selected.length > 2 ? `${selected[0]!.label} 외 ${selected.length - 1}가지` : row.text
  })
  return {
    version: RUNNING_PROFILE_VERSION,
    title: meaningful.length ? summary.join(" / ") : "아직 정하지 않아도 괜찮아요",
    rows,
    answeredCount: rows.filter(row => row.status !== "UNANSWERED").length,
    source: "직접 고른 응답",
    limit: "좋아하는 방식이에요. 잘하는 종목이나 훈련 강도를 판정한 결과는 아니에요.",
  }
}

export const PROFILE_STAGES = ["overview", ...PROFILE_QUESTION_IDS, "preferences", "records", "training", "changes"] as const
export type RunningProfileStage = typeof PROFILE_STAGES[number]
export function isRunningProfileStage(value: unknown): value is RunningProfileStage {
  return typeof value === "string" && PROFILE_STAGES.some(stage => stage === value)
}
