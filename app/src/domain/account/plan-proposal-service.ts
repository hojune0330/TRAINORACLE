import { z } from "zod"
import { supabase } from "./supabase-client"

const proposalRowSchema = z.object({
  id: z.string().uuid(),
  proposal_payload: z.unknown(),
  status: z.enum(["DRAFT", "WARNING_REVIEWED", "ACTIVE", "USER_ACCEPTED_WITH_WARNING", "REJECTED"]),
  warning_reason: z.string().nullable(),
  conservative_alternative: z.string().nullable(),
  created_at: z.string().datetime(),
})
const proposalPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  changeSummary: z.string().trim().min(1).max(500),
})

export type PlanProposalSummary = {
  readonly id: string
  readonly title: string
  readonly changeSummary: string
  readonly warningReason: string | null
  readonly conservativeAlternative: string | null
  readonly status: "DRAFT" | "WARNING_REVIEWED" | "ACTIVE" | "USER_ACCEPTED_WITH_WARNING" | "REJECTED"
  readonly createdAt: string
  readonly reviewable: boolean
}

export type PlanProposalReviewResult = {
  readonly ok: boolean
  readonly status?: PlanProposalSummary["status"]
  readonly message: string
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

export async function reviewPlanProposal(id: string): Promise<PlanProposalReviewResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계획 제안 기능이 꺼져 있어요." }
  const { data, error } = await client.rpc("review_plan_proposal", { proposal_id: id })
  const status = z.enum(["DRAFT", "WARNING_REVIEWED", "ACTIVE", "USER_ACCEPTED_WITH_WARNING", "REJECTED"]).safeParse(data)
  if (error || !status.success) return { ok: false, message: "계획 제안을 확인하지 못했어요. 현재 계획은 그대로예요." }
  return {
    ok: true,
    status: status.data,
    message: status.data === "WARNING_REVIEWED" ? "경고와 보수적인 대안을 확인했어요." : "선택을 기록했어요.",
  }
}
