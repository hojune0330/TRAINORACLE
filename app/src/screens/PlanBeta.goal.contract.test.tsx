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

    const choices = screen.getByRole("combobox", { name: "종목" })
    expect(within(choices).getAllByRole("option")).toHaveLength(8)
    expect(Array.from((choices as HTMLSelectElement).options).map(option => option.value))
      .toEqual(["", "800", "1500", "3000", "5000", "10000", "21097", "42195"])
    expect(choices).toHaveValue("")
    expect(within(choices).queryByRole("option", { name: /기초 지구력/u })).toBeNull()
  })
})
