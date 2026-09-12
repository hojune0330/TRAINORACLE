import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AccessibleTrendTable } from "./AccessibleTrendTable"

afterEach(cleanup)

describe("accessible trend table presentation", () => {
  it("keeps the table toggle touch-safe and preserves the complete row values", () => {
    render(<AccessibleTrendTable
      caption="주간 거리"
      rows={[
        { key: "week-1", label: "8.17", value: "5킬로미터, 기록 1건" },
        { key: "week-2", label: "8.24", value: "집계 가능한 거리 기록 없음" },
      ]}
    />)

    const toggleText = screen.getByText("표로 보기")
    const toggle = toggleText.closest("summary")
    expect(toggle).toHaveStyle({
      minHeight: "var(--app-touch-min)",
      fontSize: "var(--fs-caption)",
      letterSpacing: "0",
    })

    fireEvent.click(toggleText)
    const table = screen.getByRole("table", { name: "주간 거리" })
    expect(table).toHaveTextContent("8.17")
    expect(table).toHaveTextContent("5킬로미터, 기록 1건")
    expect(table).toHaveTextContent("집계 가능한 거리 기록 없음")
  })
})
