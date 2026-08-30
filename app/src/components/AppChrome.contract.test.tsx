import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TabBar } from "./AppChrome"

describe("AppChrome tab labels", () => {
  it("distinguishes the race-record tab from the journal tab", () => {
    render(<TabBar tab="home" onTab={() => undefined} />)

    const tabBar = screen.getByRole("navigation", { name: "주 탭" })
    expect(within(tabBar).getByRole("button", { name: "경기기록" })).toBeVisible()
    expect(within(tabBar).queryByRole("button", { name: "기록" })).not.toBeInTheDocument()
    expect(within(tabBar).getByRole("button", { name: "홈" }).querySelector("svg")).toHaveAttribute("width", "13")
  })
})
