import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { todayISO } from "../../domain/journal-store"
import { PrecisionPlanIntake, PrecisionPlanSummary } from "./PrecisionPlanIntake"
import type { PrecisionPlanIntakeProps } from "./PrecisionPlanIntake"

afterEach(cleanup)

function props(overrides: Partial<PrecisionPlanIntakeProps> = {}): PrecisionPlanIntakeProps {
  return {
    draft: { eventDistanceM: 5000, eventGroup: "FIVE_K", experienceBand: "DEVELOPING", availableDayCount: 3 },
    origins: {}, startDate: todayISO(), onStartDateChange: vi.fn(), targetRaceDate: "", onTargetRaceDateChange: vi.fn(),
    onDraftChange: vi.fn(), onEditEntry: vi.fn(), onManageRecords: vi.fn(), onOpenNotationReader: vi.fn(),
    onComplete: vi.fn(), onCancel: vi.fn(), ...overrides,
  }
}

describe("precision plan intake", () => {
  it("keeps optional defaults explicit and summarizes them before completing", async () => {
    const user = userEvent.setup()
    const onDraftChange = vi.fn()
    render(<PrecisionPlanIntake {...props({ onDraftChange })} />)

    expect(screen.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "설정 목차" }))
    expect(screen.getByRole("heading", { name: "기록·일정 직접 설정" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "훈련 구성 설정 열기" }))
    await user.click(screen.getByRole("button", { name: /혼합 훈련 기본값/u }))
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ trainingFocus: "MIXED_INTENT", selectedDetailedTemplateRef: null }),
      expect.objectContaining({ trainingFocus: "DEFAULT", selectedDetailedTemplateRef: "DEFAULT" }),
    )

    await user.click(screen.getByRole("button", { name: "선택한 조건" }))
    expect(screen.getByRole("heading", { name: "계획 기준 확인" })).toBeVisible()
    expect(screen.getByText("혼합 훈련")).toBeVisible()
    expect(screen.getAllByText("기본 설정").length).toBeGreaterThan(0)
    expect(screen.getByText(/아직 계획은 만들거나 저장하지 않았어요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "몸 상태 확인으로" })).toBeEnabled()
  })

  it("requires experience and training days when they are absent", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<PrecisionPlanIntake {...props({ draft: { eventDistanceM: 5000, eventGroup: "FIVE_K" }, onComplete })} />)
    expect(screen.queryByRole("button", { name: "기본 설정으로 건너뛰기" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "설정 목차" }))
    await user.click(screen.getByRole("button", { name: "설정 확인" }))
    expect(screen.getByRole("button", { name: "몸 상태 확인으로" })).toBeDisabled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("flows to the next chapter without forcing a chapter landing", async () => {
    const user = userEvent.setup()
    render(<PrecisionPlanIntake {...props({ draft: { eventDistanceM: 5000, eventGroup: "FIVE_K" } })} />)
    const starterChoice = screen.getAllByRole("button").find(button => button.textContent?.includes("달리기를 막 시작했어요"))
    expect(starterChoice).toBeDefined()
    await user.click(starterChoice!)
    expect(screen.getByText(/대회 날짜/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "날짜 없이 계속" }))
    expect(screen.getByRole("heading", { name: /언제부터 계획을 시작/u })).toBeVisible()
  })

  it("allows direct chapter access and entry editing without completing or saving", async () => {
    const user = userEvent.setup()
    const onEditEntry = vi.fn()
    const onComplete = vi.fn()
    render(<PrecisionPlanIntake {...props({ onEditEntry, onComplete })} />)
    await user.click(screen.getByRole("button", { name: "설정 목차" }))
    await user.click(screen.getByRole("button", { name: "종목·기록 확인" }))
    expect(onEditEntry).toHaveBeenCalledOnce()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("labels restored values as unknown while retaining an explicit user default", () => {
    render(<PrecisionPlanSummary draft={{ eventDistanceM: 5000, trainingFocus: "MIXED_INTENT" }}
      origins={{ eventDistanceM: "RESTORED_ORIGIN_UNKNOWN", trainingFocus: "USER" }} />)
    expect(screen.getByText("이전 설정")).toBeVisible()
    expect(screen.getByText("직접 선택")).toBeVisible()
  })

  it("shows the exact record basis and its date in the review", () => {
    render(<PrecisionPlanSummary draft={{ eventDistanceM: 5000 }} origins={{}}
      instantEntry={{ kind: "CURRENT_RECORD", eventDistanceM: 5000, performanceSeconds: 1140, achievedOn: "2026-10-12" }} />)
    expect(screen.getByText("현재 기록 · 5000m · 19분 0초 · 2026-10-12")).toBeVisible()
  })
})
