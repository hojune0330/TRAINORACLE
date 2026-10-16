import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { MetricSummary } from "./MetricSummary"

afterEach(cleanup)
it("preserves actual zero, missing data and each metric's independent period", () => {
  render(<MetricSummary label="확인한 기록" items={[
    { id: "distance", label: "달린 거리", value: "0 km", period: "최근 4주" },
    { id: "types", label: "훈련 종류", value: "직접 고른 기록 없음", period: "최근 8주" },
  ]} />)
  expect(screen.getByText("0 km")).toBeVisible()
  expect(screen.getByText("직접 고른 기록 없음")).toBeVisible()
  expect(screen.getByText("최근 4주").closest("div")).toHaveTextContent("0 km")
  expect(screen.getByText("최근 8주").closest("div")).not.toHaveTextContent("0 km")
  expect(screen.queryByText("0가지")).toBeNull()
})
it("does not create an empty panel when no values were supplied", () => {
  const view = render(<MetricSummary items={[]} />)
  expect(view.container).toBeEmptyDOMElement()
})
