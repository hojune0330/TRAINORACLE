import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { CatalogCycleSuccessorSummary } from "../../domain/catalog-cycle-successor"
import { CatalogCycleSummary } from "./CatalogCycleSummary"

const summary: CatalogCycleSuccessorSummary = {
  status: "APPLIED", reason: "DETAILED_MAIN_SUCCESSOR", headline: "이전 기록을 반영한 새 계획안이에요.",
  responseStatus: "COMPLETE_RESPONSE", appliedCount: 1, maintainedCount: 0, reducedCount: 1, reviewCount: 0,
  requiresEnvironmentConfirmation: false, futureEnvironmentVerified: false,
  rows: [{ status: "REDUCED", reason: "REPEATED_ABOVE_REVIEWED_LOWER", explanation: "검토된 낮은 구성으로 제안해요.",
    purpose: "LT_INTENT", ordinal: 1, source: { day: 1, slot: "AM", catalogId: "P-LT-B" },
    target: { day: 2, slot: "PM", catalogId: "P-LT-B-480" }, sourceActualRpe: 9, sourceComparison: "ABOVE_RANGE",
    comparisons: [], repeatedAboveCount: 2, environmentRequirements: [], applied: true,
    sourceNotation: "2 × 10min @ RPE 6–7 · r60s Jog", targetNotation: "2 × 8min @ RPE 6–7 · r60s Jog" }],
}

afterEach(cleanup)

describe("next-cycle explanation", () => {
  it("keeps the first view short and exposes exact old/new work under the disclosure", () => {
    const { container } = render(<CatalogCycleSummary summary={summary} startDate="2026-10-01" />)
    const detail = container.querySelector("details")!
    expect(detail.open).toBe(false)
    fireEvent.click(screen.getByText("이전 수행을 어떻게 반영했나요?"))
    expect(detail.open).toBe(true)
    expect(screen.getByText("2 × 10min @ RPE 6–7 · r60s Jog", { exact: false })).toBeVisible()
    expect(screen.getByText("2 × 8min @ RPE 6–7 · r60s Jog", { exact: false })).toBeVisible()
    expect(screen.getByText(/같은 목적에서 계획보다 높게 기록한 RPE 2회/)).toBeVisible()
    expect(screen.getByText(/2026-10-02/)).toHaveTextContent("오후")
  })

  it("does not invent a before/after prescription when no detail was applied", () => {
    render(<CatalogCycleSummary summary={{ ...summary, rows: [{ ...summary.rows[0]!, applied: false }] }} startDate="2026-10-01" />)
    expect(screen.queryByText("이전 훈련")).not.toBeInTheDocument()
    expect(screen.queryByText("다음 훈련")).not.toBeInTheDocument()
  })
})
