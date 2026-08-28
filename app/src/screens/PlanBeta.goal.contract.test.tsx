import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe("plan beta goal choice", () => {
  it("shows the seven initial target events without a generic unbound goal", () => {
    render(<PlanBeta />)

    const choices = screen.getByRole("group", { name: "계획 종목 선택" })
    expect(within(choices).getAllByRole("button")).toHaveLength(7)
    expect(within(choices).getByRole("button", { name: /^800m/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^1500m/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^3000m/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^5000m/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^10km/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^하프마라톤/u })).toBeVisible()
    expect(within(choices).getByRole("button", { name: /^마라톤/u })).toBeVisible()
    expect(within(choices).queryByRole("button", { name: /기초 지구력/u })).toBeNull()
  })
})
