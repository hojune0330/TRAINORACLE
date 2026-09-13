import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { TermHelp } from "./TermHelp"
import { AppOverlayNavigationProvider } from "./AppOverlayNavigation"
import { GLOSSARY } from "../domain/glossary"

afterEach(cleanup)

describe("plan help copy", () => {
  it("preserves the help touch target inside a shrinking flex row", () => {
    render(<div style={{ display: "flex", width: 100 }}><TermHelp term="training-notation" /></div>)
    const button = screen.getByRole("button", { name: "훈련표 읽는 법 설명 보기" })
    expect(button).toHaveStyle({ minWidth: "44px", flexShrink: "0" })
    expect(button.parentElement).toHaveStyle({ flexShrink: "0" })
  })

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

  it("uses in-app term navigation without reloading when the shell provides it", async () => {
    const user = userEvent.setup()
    let opened = ""
    render(
      <AppOverlayNavigationProvider openTrainingTerm={(term) => { opened = term }} openFeedback={() => undefined}>
        <TermHelp term="rpe" />
      </AppOverlayNavigationProvider>,
    )

    await user.click(screen.getByRole("button", { name: /운동 자각도.*설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))

    expect(opened).toBe("rpe")
    expect(screen.queryByText(GLOSSARY.rpe.short)).not.toBeInTheDocument()
  })
})
