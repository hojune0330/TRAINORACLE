import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AthleteRecords } from "./AthleteRecords"
import { prepareCurrentPaceUpdate } from "../domain/active-plan-edit-store"
import { loadAthleteRecords } from "../domain/athlete-records"

vi.mock("../domain/plan-beta-store", () => ({ loadVersionedPlanBetaState: () => ({
  version: 3, activePlan: { eventDistanceM: 10000, sessions: [{ prescription: {
    kind: "RPE_TIME_RANGE", catalogWorkout: { inputs: { fiveK: null,
      paceReferences: [{ eventDistanceM: 10000 }] } },
  } }] },
}) }))
vi.mock("../domain/active-plan-edit-store", () => ({
  prepareCurrentPaceUpdate: vi.fn(), applyActivePlanEdit: vi.fn(), prepareCurrentPaceUndo: vi.fn(),
}))
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

it("keeps the user on an explanation after saving a linked record that exceeds the plan limits", async () => {
  vi.mocked(prepareCurrentPaceUpdate).mockResolvedValue({ kind: "blocked", reasonCode: "TARGET_UNAVAILABLE",
    message: "확인한 시간 범위를 벗어나 계획은 그대로예요.", permittedTargets: [],
    excluded: [{ day: 3, slot: "AM", reasonCode: "PROPOSAL_INVALID", reason: "확인한 시간 범위를 넘어요." }],
  })
  const onSaved = vi.fn(), user = userEvent.setup()
  render(<AthleteRecords onBack={() => undefined} onSaved={onSaved} />)
  expect(screen.getByRole("combobox", { name: "종목 거리" })).toHaveValue("10000")
  await user.type(screen.getByRole("textbox", { name: "기록 분" }), "41")
  await user.type(screen.getByRole("textbox", { name: "기록 초" }), "1")
  await user.click(screen.getByRole("button", { name: "기록 저장" }))
  expect(await screen.findByRole("region", { name: "기록에 따른 계획 변경" })).toBeVisible()
  expect(await screen.findByText("확인한 시간 범위를 벗어나 계획은 그대로예요.")).toBeVisible()
  expect(onSaved).not.toHaveBeenCalled()
  expect(loadAthleteRecords()).toHaveLength(1)
  expect(screen.queryByRole("button", { name: "남은 훈련에 적용" })).not.toBeInTheDocument()
})
