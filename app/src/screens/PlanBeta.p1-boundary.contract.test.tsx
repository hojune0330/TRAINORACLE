import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { PlanBeta } from "./PlanBeta"

const ATHLETE_RECORDS_KEY = "trainoracle.athlete-records.v1"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

it("opens the plan flow without creating an athlete record", () => {
  render(<PlanBeta />)

  expect(screen.getByRole("heading", {
    name: "준비할 달리기를 골라주세요",
  })).toBeVisible()
  expect(window.localStorage.getItem(ATHLETE_RECORDS_KEY)).toBeNull()
})
