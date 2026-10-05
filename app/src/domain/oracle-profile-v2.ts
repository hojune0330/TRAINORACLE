import { z } from "zod"

export const ORACLE_QUESTION_VERSION = "ORACLE_QUESTIONS_V2_1" as const
export const ORACLE_SCORE_VERSION = "SELF_RESPONSE_INDEX_V1" as const
export const ORACLE_CHARACTER_VERSION = "RESPONSE_NICKNAME_V1" as const

export const ORACLE_AXES = [
  { id: "CHALLENGE", label: "기록 도전 선호", optional: false, character: "기록 도전자", questions: [
    "내가 세운 기록 목표에 도전하는 일이 즐거워요.",
    "이전의 내 기록을 넘어보는 과정이 좋아요.",
    "나만의 목표 기록을 정하고 달리는 것이 좋아요.",
  ] },
  { id: "INTENSITY", label: "높은 강도 선호", optional: false, character: "강한 달리기 애호가", questions: [
    "운동할 수 있는 몸 상태라면, 숨이 많이 차는 강도의 달리기를 즐겨요.",
    "몸에 무리가 없는 범위에서 힘차게 달리는 느낌이 좋아요.",
    "충분히 회복한 날에는 강도 높은 달리기가 즐거워요.",
  ] },
  { id: "STRUCTURE", label: "계획 선호", optional: false, character: "계획을 즐기는 러너", questions: [
    "달리기 전에 할 내용을 정해두는 것이 좋아요.",
    "훈련 순서가 미리 정해져 있으면 마음이 편해요.",
    "앞으로 달릴 일정을 미리 살펴보는 것이 좋아요.",
  ] },
  { id: "SOCIAL", label: "함께 달리기 선호", optional: false, character: "함께 달리는 러너", questions: [
    "혼자 달릴 수도 있는 날에, 다른 사람과 함께 달리는 것이 좋아요.",
    "서로 편한 속도를 맞출 수 있다면 함께 달리는 시간이 즐거워요.",
    "다른 사람과 달리기를 함께하는 것 자체가 좋아요.",
  ] },
  { id: "EXPLORE", label: "새 경험 선호", optional: false, character: "새로움을 찾는 러너", questions: [
    "달리기에서 익숙하지 않은 새로운 경험을 하는 것이 좋아요.",
    "달리면서 이전에 해보지 않은 경험을 하는 것이 즐거워요.",
    "익숙한 달리기와 다른 경험을 만나는 것이 좋아요.",
  ] },
  { id: "REFRESH", label: "기분 전환 동기", optional: false, character: "기분 전환 러너", questions: [
    "기분을 전환하는 것은 내가 달리는 이유 중 하나예요.",
    "일상에서 잠시 벗어나고 싶어서 달리기를 선택해요.",
    "마음을 환기하는 시간이 필요해서 달려요.",
  ] },
  { id: "SU", label: "보조 운동 선호", optional: true, character: null, questions: [
    "달리기 외에 보조 운동을 하는 시간이 좋아요.",
    "보조 운동을 하는 과정이 즐거워요.",
    "달리기와 별개로 보조 운동 자체에 재미를 느껴요.",
  ] },
  { id: "WE", label: "웨이트 선호", optional: true, character: null, questions: [
    "내게 맞는 무게로 웨이트를 하는 시간이 좋아요.",
    "웨이트 동작을 수행하는 과정이 즐거워요.",
    "달리기에 주는 효과와 별개로 웨이트 자체에 재미를 느껴요.",
  ] },
] as const

for (const axis of ORACLE_AXES) { Object.freeze(axis.questions); Object.freeze(axis) }
Object.freeze(ORACLE_AXES)

export type OracleAxisId = typeof ORACLE_AXES[number]["id"]
export type OracleQuestionId = `${OracleAxisId}_${1 | 2 | 3}`
export const ORACLE_QUESTIONS = Object.freeze(ORACLE_AXES.flatMap(axis => axis.questions.map((text, index) => Object.freeze({
  id: `${axis.id}_${index + 1}` as OracleQuestionId, axisId: axis.id, text,
  version: ORACLE_QUESTION_VERSION,
}))))
export const ORACLE_NEUTRAL_CHARACTER = Object.freeze({ id: "NEUTRAL" as const, label: "나의 러닝 프로필" })
export const ORACLE_NON_NUMERIC = Object.freeze(["UNKNOWN", "VARIES", "INEXPERIENCED", "SKIPPED"] as const)
const responseSchema = z.union([z.number().int().min(1).max(5), z.enum(ORACLE_NON_NUMERIC)])
export type OracleResponse = z.infer<typeof responseSchema>
const questionIds = ORACLE_QUESTIONS.map(question => question.id) as [OracleQuestionId, ...OracleQuestionId[]]
export const oracleResponsesSchema = z.partialRecord(z.enum(questionIds), responseSchema)
export type OracleResponses = z.infer<typeof oracleResponsesSchema>

export type OracleAxisScore = {
  axisId: OracleAxisId
  label: string
  concept: "PREFERENCE" | "MOTIVATION"
  questionVersion: typeof ORACLE_QUESTION_VERSION
  scoreVersion: typeof ORACLE_SCORE_VERSION
  state: "UNANSWERED" | "PARTIAL" | "COMPLETE"
  numericCount: number
  mixed: boolean
  raw: number | null
  display: number | null
  evidence: Array<{ questionId: OracleQuestionId; response: OracleResponse | null }>
}

/** Validate before computing; missing evidence must never turn into a zero score. */
export function scoreOracleResponses(input: unknown): OracleAxisScore[] {
  const answers = oracleResponsesSchema.parse(input)
  return ORACLE_AXES.map(axis => {
    const evidence = ORACLE_QUESTIONS.filter(q => q.axisId === axis.id).map(q => ({
      questionId: q.id, response: answers[q.id] ?? null,
    }))
    const numeric = evidence.flatMap(e => typeof e.response === "number" ? [e.response] : [])
    const raw = numeric.length === 3 ? 100 * (numeric.reduce((sum, n) => sum + n, 0) - 3) / 12 : null
    return {
      axisId: axis.id, label: axis.label, questionVersion: ORACLE_QUESTION_VERSION,
      concept: axis.id === "REFRESH" ? "MOTIVATION" : "PREFERENCE",
      scoreVersion: ORACLE_SCORE_VERSION,
      state: raw !== null ? "COMPLETE" : evidence.some(e => e.response !== null) ? "PARTIAL" : "UNANSWERED",
      numericCount: numeric.length,
      mixed: numeric.some(n => n <= 2) && numeric.some(n => n >= 4),
      raw, display: raw === null ? null : 5 * Math.floor(raw / 5 + 0.5), evidence,
    }
  })
}

export function buildOracleProfile(input: unknown, selectedCharacter?: OracleAxisId | null) {
  const scores = scoreOracleResponses(input)
  const candidates = ORACLE_AXES.filter(axis => !axis.optional).filter(axis => {
    const score = scores.find(s => s.axisId === axis.id)!
    return score.display !== null && score.display >= 75 && !score.mixed
  }).map(axis => ({ id: axis.id, label: axis.character! }))
  const retained = candidates.find(candidate => candidate.id === selectedCharacter)
  const representative = retained ?? (selectedCharacter === undefined && candidates.length === 1 ? candidates[0]! : ORACLE_NEUTRAL_CHARACTER)
  return {
    scoreVersion: ORACLE_SCORE_VERSION, characterVersion: ORACLE_CHARACTER_VERSION,
    scores, candidates, representative,
    completedAxes: scores.filter(s => s.state === "COMPLETE").map(s => s.axisId),
    label: "내 응답 기준",
    limitation: "답한 범위의 선호와 동기를 정리한 결과예요. 체력 점수나 선천적 유형은 아니에요.",
  }
}

export function describeOracleAxis(score: OracleAxisScore) {
  if (score.state === "UNANSWERED") return "아직 답하지 않은 항목이에요. 다른 결과부터 볼 수 있어요."
  if (score.state === "PARTIAL") return "답한 내용은 남겨두고, 세 문항에 숫자로 답했을 때 점수를 표시해요."
  if (score.mixed) return "동의한 문항과 동의하지 않은 문항이 함께 있어요. 문항별 답을 함께 볼 수 있어요."
  if (score.display! >= 75) return `${score.label} 문항에 주로 동의했어요. 실제 훈련 횟수나 능력을 뜻하지는 않아요.`
  if (score.display! <= 25) return `${score.label} 문항에 주로 동의하지 않았어요. 의지나 능력이 부족하다는 뜻은 아니에요.`
  return `${score.label} 문항에 중간 정도로 답했어요. 낮거나 높은 쪽의 유형을 억지로 붙이지 않아요.`
}
