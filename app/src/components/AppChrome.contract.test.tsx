import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SavedToast, TabBar } from "./AppChrome"

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

beforeEach(() => vi.useFakeTimers())

describe("AppChrome tab labels", () => {
  it("distinguishes the race-record tab from the journal tab", () => {
    render(<TabBar tab="home" onTab={() => undefined} />)

    const tabBar = screen.getByRole("navigation", { name: "주 탭" })
    expect(within(tabBar).getByRole("button", { name: "경기기록" })).toBeVisible()
    expect(within(tabBar).queryByRole("button", { name: "기록" })).not.toBeInTheDocument()
    expect(within(tabBar).getByRole("button", { name: "홈" }).querySelector("svg")).toHaveAttribute("width", "13")
  })
})

describe("saved receipt date wording", () => {
  it("names the selected future journal date instead of calling it today", () => {
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "generic", savedDate: "2026-09-08" }} />)

    expect(screen.getByRole("status")).toHaveTextContent("9월 8일 기록을 남겼어요.")
  })

  it("does not claim a future saved value is already in a current aggregation window", () => {
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "distance", savedDate: "2026-09-08", distanceKm: 3 }} />)

    const toast = screen.getByRole("status")
    expect(toast).toHaveTextContent("9월 8일 3 km를 저장했어요")
    expect(toast).not.toHaveTextContent("이번 주")
    expect(toast).not.toHaveTextContent("반영")
  })

  it.each([
    ["today", "2026-09-04", { kind: "mood" as const, savedDate: "2026-09-04" }, "기분 추이 보기"],
    ["recent past", "2026-08-08", { kind: "pain" as const, savedDate: "2026-08-08", moodAlsoSaved: false }, "통증 추이 보기"],
    ["future", "2026-09-05", { kind: "distance" as const, savedDate: "2026-09-05", distanceKm: 3 }, null],
    ["older than 28 days", "2026-08-07", { kind: "mood" as const, savedDate: "2026-08-07" }, null],
  ])("keeps the trend route only when the saved %s date is in the recent window", (_case, _date, receipt, actionLabel) => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00"))
    render(<SavedToast count={0} phase="enter" receipt={receipt} />)

    if (actionLabel === null) {
      expect(screen.queryByRole("button", { name: /추이 보기/u })).toBeNull()
    } else {
      expect(screen.getByRole("button", { name: actionLabel })).toBeVisible()
    }
  })

  it("keeps the local-save default only when no saved date exists", () => {
    render(<SavedToast count={0} phase="enter" />)

    expect(screen.getByRole("status")).toHaveTextContent("이 기기에 저장됐어요")
  })
})
