import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import type { AthleteRecord } from "../../domain/athlete-records"
import { toSelectedGoalSnapshot } from "../../domain/pace-target-evidence"
import { PaceEvidenceFlow } from "./PaceEvidenceFlow"
import { PaceRecommendation } from "./PaceRecommendation"

const goal: Extract<AthleteRecord, { purpose: "RACE_GOAL" }> = {
  schemaVersion: 1, id: "explicit-goal", purpose: "RACE_GOAL", eventDistanceM: 800,
  performanceSeconds: 121.5, achievedOn: null, seasonId: null, enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED", sourceRef: "athlete-record:explicit-goal", savedAt: "2026-10-02T03:00:00.000Z",
}

it("offers a goal without auto-selection and requires a distinct aspirational confirmation", async () => {
  const confirm = vi.fn(), select = vi.fn(), user = userEvent.setup()
  const props = { eventDistanceM: 800 as const, records: [goal], selectedRecordId: null as string | null,
    comparisonRecordId: null, binding: { kind: "fallback" as const, code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" as const },
    onSelectRecord: select, onCompareRecord: vi.fn(), onConfirm: confirm }
  const { rerender } = render(<PaceEvidenceFlow {...props} />)
  const choice = screen.getByRole("button", { name: /목표.*800m/u })
  expect(choice).toHaveAttribute("aria-pressed", "false")
  expect(choice).toHaveTextContent("현재 실력 아님")
  expect(screen.queryByRole("button", { name: "이 목표 기록으로 페이스 적용" })).toBeNull()
  await user.click(choice)
  expect(select).toHaveBeenCalledWith(goal.id)
  expect(confirm).not.toHaveBeenCalled()
  rerender(<PaceEvidenceFlow {...props} selectedRecordId={goal.id} />)
  expect(screen.getByText("목표 기록을 기준으로 계산해요. 달성한 기록이나 현재 실력을 뜻하지 않아요.")).toBeVisible()
  expect(screen.queryByText(/기록일 확인 필요/u)).toBeNull()
  await user.click(screen.getByRole("button", { name: "이 목표 기록으로 페이스 적용" }))
  expect(confirm).toHaveBeenCalledOnce()
})

it("labels the saved goal recommendation as aspirational even when collapsed", () => {
  const { container } = render(<PaceRecommendation prescription={{
    selectedAnchor: toSelectedGoalSnapshot(goal, new Date(goal.savedAt)), repetitionDistanceM: 200,
    targetRepSeconds: 30.375, templateId: "MD-800-01", templateVersion: "1.0.0", displayRoundingPolicyVersion: "seconds-v1",
  }} />)
  expect(screen.getByText(/기준: 800m 목표 기록/u)).toBeVisible()
  expect(container).toHaveTextContent("현재 달성 가능한 실력을 뜻하지 않아요")
  expect(container).not.toHaveTextContent("현재 실력의 기준으로 직접 선택")
})
