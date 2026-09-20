import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { Trends } from "../Trends"

afterEach(cleanup)

describe("saved receipt navigation into Trends", () => {
  it.each([
    ["DISTANCE_KM", "거리"],
    ["MOOD", "기분"],
    ["PAIN_MAX", "통증"],
  ] as const)("opens monthly analysis with %s selected", (metric, label) => {
    render(<Trends initialContext={{ section: "monthly", metric, savedDate: "2026-09-21" }} />)

    expect(screen.getByRole("button", { name: "월별 변화" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "최근 4개월 추이" })).toBeVisible()
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("status")).toHaveTextContent("2026-09-21에 저장한")
  })

  it("keeps metric selection interactive after receipt entry", async () => {
    const user = userEvent.setup()
    render(<Trends initialContext={{ section: "monthly", metric: "DISTANCE_KM", savedDate: "2026-09-21" }} />)

    await user.click(screen.getByRole("button", { name: "기분" }))
    expect(screen.getByRole("button", { name: "기분" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "거리" })).toHaveAttribute("aria-pressed", "false")
  })
})
