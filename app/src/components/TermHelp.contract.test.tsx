import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { TermHelp } from "./TermHelp"

afterEach(cleanup)

describe("plan help copy", () => {
  it("explains that an explicitly selected PM slot can contain the main session", async () => {
    const user = userEvent.setup()
    render(<TermHelp term="two-a-day" />)

    await user.click(screen.getByRole("button", { name: /하루 두 번 운동.*설명 보기/u }))

    expect(screen.getByText(/오후에도 주요 훈련이 들어갈 수 있어요/u)).toBeVisible()
    expect(screen.getByText(/직접 선택한 경우에만 표시/u)).toBeVisible()
  })

  it("lists training time among the seven inputs used by the beta plan", async () => {
    const user = userEvent.setup()
    render(<TermHelp term="plan-beta-basis" />)

    await user.click(screen.getByRole("button", { name: /베타 계획의 근거.*설명 보기/u }))

    expect(screen.getByText(/훈련 시간대/u)).toBeVisible()
  })
})
