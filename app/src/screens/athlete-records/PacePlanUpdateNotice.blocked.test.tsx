import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PacePlanUpdateNotice } from "./PacePlanUpdateNotice"
import { prepareCurrentPaceUpdate } from "../../domain/active-plan-edit-store"
import type { AthleteRecord } from "../../domain/athlete-records"

vi.mock("../../domain/active-plan-edit-store", () => ({
  prepareCurrentPaceUpdate: vi.fn(), applyActivePlanEdit: vi.fn(), prepareCurrentPaceUndo: vi.fn(),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it("explains excluded training without offering an invalid pace application", async () => {
  vi.mocked(prepareCurrentPaceUpdate).mockResolvedValue({ kind: "blocked", reasonCode: "TARGET_UNAVAILABLE",
    message: "새 페이스가 확인한 시간 범위를 벗어나 계획은 바꾸지 않았어요.", permittedTargets: [],
    excluded: [{ day: 3, slot: "AM", reasonCode: "PROPOSAL_INVALID", reason: "확인한 시간 범위를 넘어요." }],
  })
  const record: AthleteRecord = { schemaVersion: 1, id: "recent-10k", purpose: "RECENT_RESULT",
    eventDistanceM: 10000, performanceSeconds: 2433.75, achievedOn: "2026-10-01", seasonId: null,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: "athlete-record:recent-10k",
    savedAt: "2026-10-02T03:00:00.000Z" }
  render(<PacePlanUpdateNotice record={record} onDone={() => undefined} />)
  expect(await screen.findByText("새 페이스가 확인한 시간 범위를 벗어나 계획은 바꾸지 않았어요.")).toHaveAttribute("role", "status")
  expect(screen.getByText("바꾸지 않은 훈련 1개")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "남은 훈련에 적용" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "계획은 그대로 두기" })).toBeEnabled()
})
