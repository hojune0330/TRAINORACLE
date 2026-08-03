import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FatigueExperimentPanel } from "./FatigueExperimentPanel"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => window.localStorage.clear())

describe("experimental fatigue panel", () => {
  it("explains each subjective dimension in words a young athlete can understand", () => {
    render(<FatigueExperimentPanel />)

    expect(screen.getByText("반응이 둔하거나 집중하기 어려운 느낌")).toBeVisible()
    expect(screen.getByText("숨이 차고 에너지가 바닥난 느낌")).toBeVisible()
    expect(screen.getByText("근육이 뻐근하거나 힘이 빠진 느낌")).toBeVisible()
    expect(screen.getByText("달리거나 착지할 때 몸이 받은 충격의 느낌")).toBeVisible()
    expect(screen.getByText("전체적으로 내가 느끼는 피곤함")).toBeVisible()
    expect(screen.getByText(/다섯 값을 단순히 평균해 보여줘요/u)).toBeVisible()
  })

  it("shows a composite only after the user explicitly records sourced evidence", async () => {
    const user = userEvent.setup()
    render(<FatigueExperimentPanel now={() => "2026-08-02T02:30:00.000Z"} />)

    expect(screen.getByLabelText("신경계 피로")).toBeVisible()
    expect(screen.getByLabelText("대사계 피로")).toBeVisible()
    expect(screen.getByLabelText("근육 피로")).toBeVisible()
    expect(screen.getByLabelText("충격 부하")).toBeVisible()
    expect(screen.getByLabelText("주관적 피로")).toBeVisible()
    expect(screen.queryByText(/통합 참고값 5\/10/u)).not.toBeInTheDocument()
    expect(screen.getByText(/아직 저장된 피로 기록이 없어요/u)).toBeVisible()

    await user.click(screen.getByRole("checkbox", { name: /통합 참고값 보기/u }))

    expect(screen.queryByText(/통합 참고값 5\/10/u)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("신경계 피로"), { target: { value: "8" } })
    expect(screen.getByText(/바꾼 값이 아직 저장되지 않았어요/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "지금 값 기록하기" }))

    expect(screen.getByText(/통합 참고값 6\/10/u)).toBeVisible()
    expect(screen.getByText(/내가 직접 고른 값/u)).toBeVisible()
    expect(screen.getByText(/불확실성 큼/u)).toBeVisible()
    expect(screen.getByText(/안전 판정이나 의료 판단이 아니에요/u)).toBeVisible()
    const localObservedAt = new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date("2026-08-02T02:30:00.000Z"))
    expect(screen.getByText(localObservedAt)).toHaveAttribute(
      "datetime",
      "2026-08-02T02:30:00.000Z",
    )
    expect(screen.queryByText(/UTC/u)).not.toBeInTheDocument()
  })

  it("keeps the draft visible and reports when browser storage fails", async () => {
    const user = userEvent.setup()
    render(<FatigueExperimentPanel />)
    fireEvent.change(screen.getByLabelText("신경계 피로"), { target: { value: "8" } })
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })

    await user.click(screen.getByRole("button", { name: "지금 값 기록하기" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 기기에 저장하지 못했어요. 입력한 값은 화면에 그대로 있어요.",
    )
    expect(screen.getByLabelText("신경계 피로")).toHaveValue("8")
    expect(screen.getByText(/아직 저장된 피로 기록이 없어요/u)).toBeVisible()
  })
})
