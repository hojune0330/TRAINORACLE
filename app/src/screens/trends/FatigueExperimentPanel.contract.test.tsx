import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { FatigueExperimentPanel } from "./FatigueExperimentPanel"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

describe("experimental fatigue panel", () => {
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
    expect(screen.getByText("2026-08-02 02:30 UTC")).toHaveAttribute(
      "datetime",
      "2026-08-02T02:30:00.000Z",
    )
  })
})
