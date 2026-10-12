import { createRef } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AppHeading } from "./AppHeading"

afterEach(cleanup)

describe("app heading roles", () => {
  it("keeps a native focusable heading and an explicit single accent without changing its text", () => {
    const ref = createRef<HTMLHeadingElement>()
    const { container } = render(<AppHeading ref={ref} id="entry-title" tabIndex={-1} accent className="local-title">
      어떤 일지를 쓸까요?
    </AppHeading>)
    const heading = screen.getByRole("heading", { level: 1, name: "어떤 일지를 쓸까요?" })
    expect(heading).toHaveClass("app-heading", "app-heading--screen", "app-heading--accent", "local-title")
    expect(heading).toHaveAttribute("id", "entry-title")
    expect(ref.current).toBe(heading)
    ref.current?.focus()
    expect(heading).toHaveFocus()
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(heading.querySelectorAll("img,button")).toHaveLength(0)
  })

  it("separates visual roles from document levels and does not accent supporting titles implicitly", () => {
    render(<><AppHeading variant="hero">오늘의 훈련</AppHeading>
      <AppHeading as="h2" variant="section" aria-describedby="source">최근 하루 기록</AppHeading>
      <p id="source">직접 남긴 기록</p></>)
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("app-heading--hero")
    const section = screen.getByRole("heading", { level: 2 })
    expect(section).toHaveClass("app-heading--section")
    expect(section).not.toHaveClass("app-heading--accent")
    expect(section).toHaveAccessibleDescription("직접 남긴 기록")
  })
})
