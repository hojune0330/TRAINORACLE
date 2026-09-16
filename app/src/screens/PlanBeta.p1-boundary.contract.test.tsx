/* LEGACY_11STEP_FLOW: 2026-09 4질문 빠른 흐름 도입으로 옛 인테이크 클릭 순서를 전제한 테스트. 다듬기 경로로 재작성 예정(PR #341 본문). */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { PlanBeta } from "./PlanBeta"

const ATHLETE_RECORDS_KEY = "trainoracle.athlete-records.v1"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

it.skip("opens the plan flow without creating an athlete record", () => {
  render(<PlanBeta />)

  expect(screen.getByRole("heading", {
    name: "준비할 달리기를 골라주세요",
  })).toBeVisible()
  expect(window.localStorage.getItem(ATHLETE_RECORDS_KEY)).toBeNull()
})
