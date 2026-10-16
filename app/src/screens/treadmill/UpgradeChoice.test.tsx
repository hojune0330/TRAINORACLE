import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyUpgrade, newTreadmillRun, TREADMILL_STAGES } from "../../domain/minigame/treadmill"
import { UpgradeChoice, upgradePreview } from "./UpgradeChoice"

afterEach(() => { cleanup(); vi.useRealTimers() })
describe("upgrade explanation and honest previews", () => {
  it("shows the brief effect before choices, then keeps the decision waiting for the player", () => {
    vi.useFakeTimers()
    const onPick = vi.fn()
    render(<UpgradeChoice state={newTreadmillRun()} nextStage={TREADMILL_STAGES[1]!} onPick={onPick} />)
    expect(screen.getByText("이번 판의 능력을 바꿔요")).toBeTruthy()
    expect(screen.queryByText("어떤 능력을 키울까요?")).toBeNull()
    act(() => vi.advanceTimersByTime(2400))
    expect(screen.getByText("어떤 능력을 키울까요?")).toBeTruthy()
    act(() => vi.advanceTimersByTime(60_000))
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /점프를 가볍게.*스프링 밑창/ }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith("spring")
  })
  it("skips the introduction on the second checkpoint and can replay it on demand", () => {
    render(<UpgradeChoice state={applyUpgrade(newTreadmillRun(), "spring")} nextStage={TREADMILL_STAGES[2]!} onPick={() => {}} />)
    expect(screen.getByText("어떤 능력을 키울까요?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "효과 다시 보기" }))
    expect(screen.getByText("이번 판의 능력을 바꿔요")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "바로 고르기" }))
    expect(screen.getByText("어떤 능력을 키울까요?")).toBeTruthy()
  })
  it("shows the actual stacked jump floor and accumulated costs, not the first-pick label", () => {
    const spring = applyUpgrade(newTreadmillRun(), "spring")
    expect(upgradePreview(spring, "spring").gain).toBe("점프 에너지 3 → 2")
    expect(upgradePreview(spring, "spring").cost).toBe("달리기 추진력 88 → 77.4%")
    const grip = applyUpgrade(newTreadmillRun(), "grip")
    expect(upgradePreview(grip, "grip").cost).toBe("점프 에너지 10 → 13")
    expect(upgradePreview(grip, "grip").gain).toBe("진흙 추진력 150 → 200%")
  })
})
