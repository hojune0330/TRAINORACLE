import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { TermHelp } from "./TermHelp"

afterEach(cleanup)

describe("plan help copy", () => {
  it("keeps inline help short and links to the complete explanation", async () => {
    const user = userEvent.setup()
    render(<TermHelp term="two-a-day" />)

    await user.click(screen.getByRole("button", { name: /하루 두 번 운동.*설명 보기/u }))

    expect(screen.getByText(/오전과 오후 두 번으로 나누어/u)).toBeVisible()
    expect(screen.getByRole("link", { name: "왜 이런 이름인가요?" })).toHaveAttribute("href", "?terms=1&term=two-a-day")
    expect(screen.queryByText(/모든 선수에게 필요한 방식/u)).toBeNull()
  })

  it("links beta-plan help to its dedicated glossary entry", async () => {
    const user = userEvent.setup()
    render(<TermHelp term="plan-beta-basis" />)

    await user.click(screen.getByRole("button", { name: /베타 계획에 사용한 정보.*설명 보기/u }))

    expect(screen.getByText(/실제 계획 계산에 사용한 정보/u)).toBeVisible()
    expect(screen.getByRole("link", { name: "왜 이런 이름인가요?" })).toHaveAttribute("href", "?terms=1&term=plan-beta-basis")
  })
})
