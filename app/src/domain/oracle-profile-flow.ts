import {
  ORACLE_AXES, ORACLE_QUESTIONS, buildOracleProfile, oracleResponsesSchema,
  type OracleAxisId, type OracleQuestionId, type OracleResponse, type OracleResponses,
} from "./oracle-profile-v2"

export type OracleQuestionFlow = {
  axisId: OracleAxisId
  position: 0 | 1 | 2 | 3
  draft: OracleResponses
  completed: OracleResponses
}

function questions(axisId: OracleAxisId) {
  if (!ORACLE_AXES.some(axis => axis.id === axisId)) throw new Error("UNKNOWN_ORACLE_AXIS")
  return ORACLE_QUESTIONS.filter(question => question.axisId === axisId)
}

export function startOracleQuestionFlow(input: unknown = {}, axisId: OracleAxisId = "STRUCTURE"): OracleQuestionFlow {
  const answers = oracleResponsesSchema.parse(input)
  const unanswered = questions(axisId).findIndex(question => answers[question.id] === undefined)
  return { axisId, position: (unanswered < 0 ? 3 : unanswered) as OracleQuestionFlow["position"],
    draft: structuredClone(answers), completed: structuredClone(answers) }
}

export function currentOracleQuestion(flow: OracleQuestionFlow) {
  return questions(flow.axisId)[flow.position] ?? null
}

/** The rendered question ID prevents rapid duplicate taps from answering the next question. */
export function answerOracleQuestion(flow: OracleQuestionFlow, questionId: OracleQuestionId, response: OracleResponse): OracleQuestionFlow {
  if (currentOracleQuestion(flow)?.id !== questionId) return flow
  const draft = oracleResponsesSchema.parse({ ...flow.draft, [questionId]: response })
  const position = (flow.position + 1) as OracleQuestionFlow["position"]
  const completed = { ...flow.completed }
  if (position === 3) {
    for (const question of questions(flow.axisId)) {
      const answer = draft[question.id]
      if (answer !== undefined) completed[question.id] = answer
    }
  }
  return { ...flow, position, draft, completed: position === 3 ? completed : flow.completed }
}

export function previousOracleQuestion(flow: OracleQuestionFlow): OracleQuestionFlow {
  return { ...flow, position: Math.max(0, flow.position - 1) as OracleQuestionFlow["position"] }
}

export function editOracleAxis(flow: OracleQuestionFlow, axisId: OracleAxisId): OracleQuestionFlow {
  const draft = { ...flow.draft }
  // Prior confirmed answers are not progress through a new three-question edit.
  for (const question of questions(axisId)) delete draft[question.id]
  return { ...flow, draft, axisId, position: 0 }
}

export function oracleFlowResult(flow: OracleQuestionFlow) {
  return buildOracleProfile(flow.completed)
}
