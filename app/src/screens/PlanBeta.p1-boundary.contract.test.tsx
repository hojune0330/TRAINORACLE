import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { PlanBeta } from "./PlanBeta"

const ATHLETE_RECORDS_KEY = "trainoracle.athlete-records.v1"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

it("opens the existing plan flow without creating records or calculating personal pace", () => {
  render(<PlanBeta />)

  expect(screen.getByRole("heading", {
    name: "준비할 달리기를 골라주세요",
  })).toBeVisible()
  expect(screen.getByText(
    /이번 베타는 종목별 세부 훈련이나 개인 페이스를 계산하지 않아요/u,
  )).toBeVisible()
  expect(window.localStorage.getItem(ATHLETE_RECORDS_KEY)).toBeNull()
})
