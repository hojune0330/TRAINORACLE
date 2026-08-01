import React from "react"
import {
  loadPlanProposals,
  reviewPlanProposal,
} from "../../domain/account/plan-proposal-service"
import type {
  PlanProposalReviewResult,
  PlanProposalSummary,
} from "../../domain/account/plan-proposal-service"
import { productFeatures } from "../../domain/product-features"

export function PlanProposalInbox({
  enabled = productFeatures().planProposals,
  onLoad = loadPlanProposals,
  onReview = reviewPlanProposal,
}: {
  readonly enabled?: boolean
  readonly onLoad?: () => Promise<readonly PlanProposalSummary[]>
  readonly onReview?: (id: string) => Promise<PlanProposalReviewResult>
}) {
  const [proposals, setProposals] = React.useState<readonly PlanProposalSummary[]>([])
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    let active = true
    void onLoad().then((items) => { if (active) setProposals(items) })
    return () => { active = false }
  }, [enabled, onLoad])

  if (!enabled || proposals.length === 0) return null

  const review = async (proposal: PlanProposalSummary) => {
    setBusyId(proposal.id)
    const result = await onReview(proposal.id)
    setBusyId(null)
    setNotice(result.message)
    if (result.ok && result.status !== undefined) {
      setProposals((items) => items.map((item) => item.id === proposal.id
        ? { ...item, status: result.status ?? item.status }
        : item))
    }
  }

  return (
    <section style={{ margin: "16px 20px", padding: 14, border: "1px solid var(--ink)" }} aria-label="계획 제안">
      <h2 style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 17 }}>확인할 계획 제안</h2>
      <p style={{ margin: "6px 0 12px", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
        최신 제안을 먼저 보여줘요. 확인하기 전에는 현재 계획이 바뀌지 않아요.
      </p>
      {proposals.map((proposal) => (
        <article key={proposal.id} style={{ padding: "12px 0", borderTop: "1px solid var(--hair)" }}>
          <strong style={{ fontFamily: "var(--sans)", fontSize: 14 }}>{proposal.title}</strong>
          <p style={{ margin: "5px 0", fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.55 }}>{proposal.changeSummary}</p>
          {proposal.warningReason !== null && (
            <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--line)", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6 }}>
              <b>주의할 점</b> · {proposal.warningReason}
              <br /><b>보수적인 대안</b> · {proposal.conservativeAlternative ?? "현재 계획을 유지해요."}
              <br />이 확인은 의료 허가가 아니에요.
            </div>
          )}
          <button
            type="button"
            disabled={!proposal.reviewable || busyId === proposal.id}
            onClick={() => void review(proposal)}
            style={{ width: "100%", minHeight: 44, marginTop: 10, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)", cursor: "pointer", fontFamily: "var(--sans)" }}
          >
            {proposal.warningReason === null
              ? "제안 확인하고 적용"
              : proposal.status === "WARNING_REVIEWED"
                ? "2단계 · 그래도 이 제안 선택"
                : "1단계 · 경고와 대안 확인"}
          </button>
        </article>
      ))}
      {notice !== null && <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 12 }}>{notice}</p>}
    </section>
  )
}
