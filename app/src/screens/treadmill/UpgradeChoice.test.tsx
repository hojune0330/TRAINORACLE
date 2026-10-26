import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyUpgrade, newTreadmillRun, TREADMILL_STAGES } from "../../domain/minigame/treadmill"
import { EquippedGearSummary, UpgradeChoice, upgradeChanges, upgradePreview } from "./UpgradeChoice"

vi.mock("./GamePanels", () => ({
  CharacterPortrait: ({ label, upgrades }: { label: string; upgrades: readonly string[] }) => <span role="img" aria-label={label} data-upgrades={upgrades.join(",")} />,
}))

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
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.getByRole("img", { name: "스프링 밑창 장착 후 모습" }).getAttribute("data-upgrades")).toBe("spring")
    fireEvent.click(screen.getByRole("button", { name: "장착하고 출발" }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith("spring")
    fireEvent.click(screen.getByRole("button", { name: "장착하고 출발" }))
    expect(onPick).toHaveBeenCalledTimes(1)
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
    expect(upgradePreview(spring, "grip").gain).toBe("진흙 추진력 88 → 132%")
  })
  it("lets the player replace or cancel a preview without changing the applied build", () => {
    const state = applyUpgrade(newTreadmillRun(), "grip"), onPick = vi.fn()
    render(<UpgradeChoice state={state} nextStage={TREADMILL_STAGES[2]!} onPick={onPick} />)
    fireEvent.click(screen.getByRole("button", { name: /점프를 가볍게.*스프링 밑창/ }))
    expect(screen.getByRole("img", { name: "스프링 밑창 장착 후 모습" }).getAttribute("data-upgrades")).toBe("grip,spring")
    fireEvent.click(screen.getByRole("button", { name: /오래 달리기.*일정한 박자/ }))
    expect(screen.getByRole("img", { name: "일정한 박자 장착 후 모습" }).getAttribute("data-upgrades")).toBe("grip,economy")
    expect(screen.getByRole("img", { name: "현재 장비 모습" }).getAttribute("data-upgrades")).toBe("grip")
    fireEvent.click(screen.getByRole("button", { name: "미리보기 취소" }))
    expect(screen.queryByRole("button", { name: "장착하고 출발" })).toBeNull()
    expect(onPick).not.toHaveBeenCalled()
    expect(state.upgrades).toEqual(["grip"])
  })
  it("labels a capped spring honestly and still exposes the actual remaining tradeoff", () => {
    const state = applyUpgrade(applyUpgrade(newTreadmillRun(), "spring"), "spring")
    const onPick = vi.fn()
    render(<UpgradeChoice state={state} nextStage={TREADMILL_STAGES[2]!} onPick={onPick} />)
    fireEvent.click(screen.getByRole("button", { name: /점프를 가볍게.*스프링 밑창/ }))
    expect(screen.getByText("점프 비용 최저치 · 추가 이득 없음")).toBeTruthy()
    expect(screen.getByText(/점프 에너지는 이미 최저 2예요/)).toBeTruthy()
    expect(screen.getByRole("row", { name: "점프 에너지 2 2 유지" })).toBeTruthy()
    expect(screen.getByRole("row", { name: "달리기 추진력 77.4% 68.1% 손해" })).toBeTruthy()
    expect(screen.getByText("스프링 밑창 · 2회 → 3회 적용")).toBeTruthy()
    expect(onPick).not.toHaveBeenCalled()
  })
  it("compares every changed stat against the real stacked application, including both economy costs", () => {
    const state = applyUpgrade(newTreadmillRun(), "economy")
    expect(upgradeChanges(state, "economy")).toEqual([
      { label: "달리기 소모", before: 7.2, after: 9 * (0.8 * 0.8), unit: "/초", lowerIsBetter: true },
      { label: "대시 대기", before: 3.5, after: 4.5, unit: "초", lowerIsBetter: true },
      { label: "회복 속도", before: 18, after: 20 * (0.9 * 0.9), unit: "/초", lowerIsBetter: false },
    ])
  })
  it("summarizes only equipment already applied to this run, grouping repeated choices", () => {
    const state = applyUpgrade(applyUpgrade(newTreadmillRun(), "grip"), "grip")
    render(<EquippedGearSummary state={state} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByText("2회 적용")).toBeTruthy()
    expect(screen.getByText(/점프 13 · 달리기 9\/초 · 대시 대기 2.5초/)).toBeTruthy()
    expect(screen.queryByText("스프링 밑창")).toBeNull()
  })
})
