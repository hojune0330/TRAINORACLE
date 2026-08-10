import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
  it("keeps the first plan question to three choices until the athlete asks for 10 km", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    const choices = screen.getByRole("group", { name: "계획 종목 선택" })
    expect(within(choices).getAllByRole("button")).toHaveLength(3)
    expect(within(choices).queryByRole("button", { name: /10km/u })).toBeNull()

    await user.click(screen.getByRole("button", { name: "10km 계획 보기" }))

    expect(within(choices).getAllByRole("button")).toHaveLength(4)
    expect(within(choices).getByRole("button", { name: /10km/u })).toBeVisible()
  })
})
