import { z } from "zod"
import { supabase } from "./supabase-client"

const proposalStatusSchema = z.enum([
  "DRAFT",
  "WARNING_REVIEWED",
  "ACTIVE",
  "USER_ACCEPTED_WITH_WARNING",
  "REJECTED",
  "SUPERSEDED",
])
const proposalRowSchema = z.object({
  id: z.string().uuid(),
  proposal_payload: z.unknown(),
  status: proposalStatusSchema,
  warning_reason: z.string().nullable(),
  conservative_alternative: z.string().nullable(),
  created_at: z.string().datetime(),
})
const proposalPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  changeSummary: z.string().trim().min(1).max(500),
})
const activationReceiptSchema = z.object({
  outcome: z.literal("ACTIVATED"),
  proposalId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  activeRevision: z.number().int().positive(),
  activatedAt: z.string().datetime(),
})
const warningReviewSchema = z.object({
  outcome: z.literal("WARNING_RECORDED"),
  proposalId: z.string().uuid(),
  reviewedAt: z.string().datetime(),
})

export type PlanProposalSummary = {
  readonly id: string
  readonly title: string
  readonly changeSummary: string
  readonly warningReason: string | null
  readonly conservativeAlternative: string | null
  readonly status: z.infer<typeof proposalStatusSchema>
  readonly createdAt: string
  readonly reviewable: boolean
}

export type PlanProposalWarningReviewResult = {
  readonly ok: boolean
  readonly message: string
}

export type PlanProposalActivationReceipt = Omit<z.infer<typeof activationReceiptSchema>, "outcome">

export type PlanProposalActivationResult =
  | { readonly ok: true; readonly receipt: PlanProposalActivationReceipt }
  | { readonly ok: false; readonly message: string }

const unchangedPlanMessage = "계획을 적용하지 못했어요. 현재 계획은 그대로예요."

export function parsePlanProposalActivationResult(candidate: unknown): PlanProposalActivationResult {
  const parsed = activationReceiptSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, message: unchangedPlanMessage }
  const { outcome: _outcome, ...receipt } = parsed.data
  return { ok: true, receipt }
}

export async function loadPlanProposals(): Promise<readonly PlanProposalSummary[]> {
  const client = await supabase()
  if (client === null) return []
  const { data: sessionData } = await client.auth.getSession()
  const userId = sessionData.session?.user.id
  if (userId === undefined) return []
  const { data, error } = await client
    .from("plan_proposals")
    .select("id, proposal_payload, status, warning_reason, conservative_alternative, created_at")
    .eq("athlete_id", userId)
    .in("status", ["DRAFT", "WARNING_REVIEWED"])
    .order("created_at", { ascending: false })
    .limit(10)
  if (error) return []

  return (data ?? []).flatMap((candidate: unknown) => {
    const row = proposalRowSchema.safeParse(candidate)
    if (!row.success) return []
    const payload = proposalPayloadSchema.safeParse(row.data.proposal_payload)
    return [{
      id: row.data.id,
      title: payload.success ? payload.data.title : "내용을 확인할 수 없는 계획 제안",
      changeSummary: payload.success ? payload.data.changeSummary : "제안 형식이 맞지 않아 선택할 수 없어요.",
      warningReason: row.data.warning_reason,
      conservativeAlternative: row.data.conservative_alternative,
      status: row.data.status,
      createdAt: row.data.created_at,
      reviewable: payload.success,
    }]
  })
}

export async function recordPlanProposalWarningReview(
  id: string,
  reviewReason: string,
): Promise<PlanProposalWarningReviewResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: unchangedPlanMessage }
  const { data, error } = await client.rpc("record_plan_proposal_warning_review", {
    proposal_id: id,
    review_reason: reviewReason,
  })
  if (error || !warningReviewSchema.safeParse(data).success) return { ok: false, message: unchangedPlanMessage }
  return { ok: true, message: "경고 검토를 기록했어요. 이 확인은 의료 허가가 아니에요." }
}

export async function activatePlanProposal(id: string): Promise<PlanProposalActivationResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: unchangedPlanMessage }
  const { data, error } = await client.rpc("activate_plan_proposal", { proposal_id: id })
  if (error) return { ok: false, message: unchangedPlanMessage }
  return parsePlanProposalActivationResult(data)
}
