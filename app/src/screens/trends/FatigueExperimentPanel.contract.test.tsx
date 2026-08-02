import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { FatigueExperimentPanel } from "./FatigueExperimentPanel"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

describe("experimental fatigue panel", () => {
  it("keeps five fatigue dimensions separate and requires explicit opt-in for a composite", async () => {
    const user = userEvent.setup()
    render(<FatigueExperimentPanel />)

    expect(screen.getByLabelText("신경계 피로")).toBeVisible()
    expect(screen.getByLabelText("대사계 피로")).toBeVisible()
    expect(screen.getByLabelText("근육 피로")).toBeVisible()
    expect(screen.getByLabelText("충격 부하")).toBeVisible()
    expect(screen.getByLabelText("주관적 피로")).toBeVisible()
    expect(screen.queryByText(/통합 참고값 5\/10/u)).not.toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /통합 참고값 보기/u }))

    expect(screen.getByText(/통합 참고값 5\/10/u)).toBeVisible()
    expect(screen.getByText(/안전 판정이나 의료 판단이 아니에요/u)).toBeVisible()
  })
})
