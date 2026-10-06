import { z } from "zod"
import { ORACLE_QUESTIONS, ORACLE_QUESTION_VERSION, ORACLE_SCORE_VERSION, type OracleQuestionId } from "../oracle-profile-v2"
import { accountOracleV2DocumentSchema } from "./account-oracle-v2-schema"

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
const question = z.enum(ORACLE_QUESTIONS.map(q => q.id) as [OracleQuestionId, ...OracleQuestionId[]])
export const comparisonFieldsSchema = z.array(question).min(1).max(24).refine(fields => new Set(fields).size === fields.length)
const base = { comparisonId: z.uuid() }
export const profileComparisonRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createInvite"), expiresAt: z.iso.datetime() }).strict(),
  z.object({ action: z.literal("acceptInvite"), invitationCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/u) }).strict(),
  z.object({ ...base, action: z.literal("invitationStatus") }).strict(),
  z.object({ ...base, action: z.literal("consent"), documentId: z.uuid(), documentRevision: revision,
    profileRevision: revision, questionVersion: z.literal(ORACLE_QUESTION_VERSION), scoreVersion: z.literal(ORACLE_SCORE_VERSION),
    fields: comparisonFieldsSchema, expiresAt: z.iso.datetime() }).strict(),
  z.object({ ...base, action: z.literal("allowExternal"), fields: comparisonFieldsSchema, expiresAt: z.iso.datetime() }).strict(),
  z.object({ ...base, action: z.literal("compare") }).strict(),
  z.object({ ...base, action: z.literal("export") }).strict(),
  z.object({ ...base, action: z.literal("status") }).strict(),
  z.object({ ...base, action: z.literal("revoke") }).strict(),
  z.object({ ...base, action: z.literal("revokeExternal") }).strict(),
])
export type ProfileComparisonRequest = z.infer<typeof profileComparisonRequestSchema>
export const profileComparisonResponseSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("invitation-created"), invitationCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/u), expiresAt: z.string() }).strict(),
  z.object({ ...base, kind: z.literal("invitation"), accepted: z.boolean(), peerLabel: z.string().max(80).nullable(), expiresAt: z.string() }).strict(),
  z.object({ ...base, kind: z.literal("consented") }).strict(),
  z.object({ ...base, kind: z.literal("external-consented") }).strict(),
  z.object({ ...base, kind: z.literal("revoked") }).strict(),
  z.object({ ...base, kind: z.literal("external-revoked") }).strict(),
  z.object({ ...base, kind: z.literal("status"), consented: z.boolean(), revoked: z.boolean(), externalConsented: z.boolean(),
    fields: z.array(question), expiresAt: z.string().nullable() }).strict(),
  z.object({ ...base, kind: z.literal("comparison"), questionVersion: z.literal(ORACLE_QUESTION_VERSION), scoreVersion: z.literal(ORACLE_SCORE_VERSION),
    sourceProfileRevisions: z.object({ self: revision, peer: revision }).strict(),
    rows: z.array(z.object({ questionId: question, label: z.string().min(1).max(200), same: z.boolean() }).strict()).max(24),
    comparedCount: z.number().int().min(0).max(24), matchingCount: z.number().int().min(0).max(24), checkedAt: z.string(), validUntil: z.string(),
  }).strict().superRefine((value, context) => {
    if (value.comparedCount !== value.rows.length || value.matchingCount !== value.rows.filter(r => r.same).length
      || new Set(value.rows.map(r => r.questionId)).size !== value.rows.length
      || value.rows.some(row => ORACLE_QUESTIONS.find(q => q.id === row.questionId)?.text !== row.label)) context.addIssue({ code: "custom", message: "Invalid comparison facts" })
  }),
  z.object({ ...base, kind: z.literal("export"), text: z.string().min(1).max(12000), checkedAt: z.string(), validUntil: z.string() }).strict(),
])
export type ProfileComparisonResponse = z.infer<typeof profileComparisonResponseSchema>

/** Only the current active encrypted-account profile can supply these answers. */
export function readComparisonProfile(document: unknown, expected: { profileRevision: number; questionVersion: string; scoreVersion: string }) {
  const parsed = accountOracleV2DocumentSchema.safeParse(document)
  const current = parsed.success && parsed.data.data.status === "ACTIVE" ? parsed.data.data.current : null
  if (!current || current.revision !== expected.profileRevision || current.questionVersion !== expected.questionVersion
    || current.scoreVersion !== expected.scoreVersion) throw new Error("PROFILE_COMPARISON_UNAVAILABLE")
  return current
}

export function comparePermittedProfileAnswers(own: unknown, peer: unknown, grants: {
  self: { profileRevision: number; questionVersion: string; scoreVersion: string; fields: unknown }
  peer: { profileRevision: number; questionVersion: string; scoreVersion: string; fields: unknown }
}) {
  const a = readComparisonProfile(own, grants.self), b = readComparisonProfile(peer, grants.peer)
  if (a.questionVersion !== b.questionVersion || a.scoreVersion !== b.scoreVersion) throw new Error("PROFILE_COMPARISON_UNAVAILABLE")
  const ownFields = comparisonFieldsSchema.parse(grants.self.fields), peerFields = comparisonFieldsSchema.parse(grants.peer.fields)
  const rows = ORACLE_QUESTIONS.filter(q => ownFields.includes(q.id) && peerFields.includes(q.id)
    && typeof a.answers[q.id] === "number" && typeof b.answers[q.id] === "number")
    .map(q => ({ questionId: q.id, label: q.text, same: a.answers[q.id] === b.answers[q.id] }))
  return { questionVersion: a.questionVersion, scoreVersion: a.scoreVersion,
    sourceProfileRevisions: { self: a.revision, peer: b.revision }, rows,
    comparedCount: rows.length, matchingCount: rows.filter(row => row.same).length }
}

export function profileComparisonExportText(result: ReturnType<typeof comparePermittedProfileAnswers>) {
  return ["오라클 · 양측이 외부 공유를 허락한 응답 비교", `비교 가능한 숫자 응답 ${result.comparedCount}개 중 같은 답 ${result.matchingCount}개`,
    ...result.rows.map(row => `${row.label}: ${row.same ? "같은 답" : "다른 답"}`),
    "모름·상황별·경험 없음·건너뜀·미응답은 비교에서 제외했습니다. 관계 궁합이나 능력 점수가 아닙니다.",
    "이미 복사하거나 다운로드한 내용은 동의 철회로 회수할 수 없습니다.",
  ].join("\n")
}
