import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("plan calendar selection", () => {
  it("does not invent calendar dates while the start date is empty", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /^1500m/u }))
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
    await user.click(screen.getByRole("button", { name: /RPE 기준으로 받기/u }))
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
    await user.click(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
    await user.click(screen.getByRole("button", { name: "날짜 없이 계획안 보기" }))

    const startDate = screen.getByLabelText("계획 시작 날짜")
    await user.clear(startDate)

    expect(screen.getByRole("alert")).toHaveTextContent("실제 날짜를 고른 뒤 계획을 선택해 주세요")
    expect(screen.getByText(/시작 날짜를 고르면 실제 날짜에 맞춘 계획을 보여드려요/u))
      .toHaveAttribute("role", "status")
    expect(screen.queryByLabelText("9.5일 달력 요약")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /선택하기/u })[0]).toBeDisabled()
  })

  it("keeps a chosen date and two daily sessions when the athlete activates a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /^1500m/u }))
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
    await user.click(screen.getByRole("button", { name: /RPE 기준으로 받기/u }))
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
    await user.click(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
    await user.click(screen.getByRole("button", { name: "날짜 없이 계획안 보기" }))

    const startDate = screen.getByLabelText("계획 시작 날짜")
    await user.clear(startDate)
    await user.type(startDate, "2026-08-17")

    expect(screen.getAllByRole("group", { name: /훈련 2개/u })).toHaveLength(3)
    const lastDayPreviews = screen.getAllByRole("group", {
      name: "8월 25일 화요일 · 훈련 2개",
    })
    expect(lastDayPreviews).toHaveLength(1)
    expect(lastDayPreviews[0]).toHaveTextContent("오후")

    await user.click(screen.getAllByRole("button", { name: /선택하기/u })[0]!)

    expect(screen.getByRole("group", {
      name: "8월 25일 화요일 · 훈련 2개",
    })).toBeVisible()
    expect(screen.getAllByRole("group", { name: /훈련 2개/u })).toHaveLength(3)
    expect(JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "{}")).toMatchObject({
      intake: { startDate: "2026-08-17" },
    })
  })

  it("keeps the chosen date when the first plan save fails and the athlete retries", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /^1500m/u }))
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
    await user.click(screen.getByRole("button", { name: /RPE 기준으로 받기/u }))
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
    await user.click(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
    await user.click(screen.getByRole("button", { name: "날짜 없이 계획안 보기" }))

    const startDate = screen.getByLabelText("계획 시작 날짜")
    await user.clear(startDate)
    await user.type(startDate, "2026-08-17")
    const realSetItem = Storage.prototype.setItem
    let firstPlanWrite = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1" && firstPlanWrite) {
        firstPlanWrite = false
        throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })

    await user.click(screen.getAllByRole("button", { name: /선택하기/u })[0]!)

    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByLabelText("계획 시작 날짜")).toHaveValue("2026-08-17")

    await user.click(screen.getByRole("button", { name: "계획 다시 저장하기" }))

    expect(screen.getByRole("group", {
      name: "8월 25일 화요일 · 훈련 2개",
    })).toBeVisible()
    expect(JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "{}")).toMatchObject({
      intake: { startDate: "2026-08-17" },
    })
  })
})
