import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SavedToast, TabBar } from "./AppChrome"

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

beforeEach(() => vi.useFakeTimers())

describe("AppChrome tab labels", () => {
  it("offers four destinations with a separate recording action", () => {
    const onTab = vi.fn()
    render(<TabBar tab="trends" onTab={onTab} onStartRecording={vi.fn()} />)
    const tabBar = screen.getByRole("navigation", { name: "주 탭" })
    const oracle = within(tabBar).getByRole("button", { name: "오라클" })
    expect(oracle).toHaveAttribute("aria-current", "page")
    expect(within(tabBar).queryByRole("button", { name: "분석" })).not.toBeInTheDocument()
    expect(within(tabBar).getByRole("button", { name: "훈련" })).toBeVisible()
    fireEvent.click(oracle)
    expect(onTab).toHaveBeenCalledWith("trends")
  })

  it("starts recording without changing the selected destination", () => {
    const onTab = vi.fn(), onStartRecording = vi.fn()
    render(<TabBar tab="home" onTab={onTab} onStartRecording={onStartRecording} />)

    const tabBar = screen.getByRole("navigation", { name: "주 탭" })
    expect(within(tabBar).getByRole("button", { name: "기록하기" })).toBeVisible()
    const record = within(tabBar).getByRole("button", { name: "기록하기" })
    fireEvent.click(record)
    expect(onStartRecording).toHaveBeenCalledOnce()
    expect(onTab).not.toHaveBeenCalled()
    expect(record).not.toHaveAttribute("aria-current")
    expect(within(tabBar).getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page")
    expect(within(tabBar).getByRole("button", { name: "홈" }).querySelector("svg")).toHaveAttribute("width", "22")
  })
})

describe("saved receipt date wording", () => {
  it.each([
    [{ kind: "pain" as const, savedDate: "2026-10-18", moodAlsoSaved: false }, "통증", "통증 추이 보기"],
    [{ kind: "mood" as const, savedDate: "2026-10-18" }, "기분", "기분 추이 보기"],
  ])("shows one success statement without an empty detail row for %s", (receipt, fact, actionLabel) => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00"))
    const onOpenTrends = vi.fn()
    const onOpenSaved = vi.fn()
    render(<SavedToast count={1} phase="enter" receipt={receipt} onOpenTrends={onOpenTrends} onOpenSaved={onOpenSaved} />)

    const toast = screen.getByRole("status")
    expect(toast).toHaveTextContent(`오늘 ${fact} 기록이 저장됐어요 · 총 1건`)
    expect(toast.querySelector(".saved-toast__detail")).toBeNull()
    expect(toast).not.toHaveTextContent("선택한 날짜의")
    fireEvent.click(within(toast).getByRole("button", { name: actionLabel }))
    expect(onOpenTrends).toHaveBeenCalledOnce()
    fireEvent.click(within(toast).getByRole("button", { name: "기록 보기" }))
    expect(onOpenSaved).toHaveBeenCalledOnce()
  })

  it("keeps an additional saved fact and reward status beside a compact pain receipt", () => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00"))
    const retryReward = vi.fn()
    render(<SavedToast count={1} phase="enter" receipt={{ kind: "pain", savedDate: "2026-10-18", moodAlsoSaved: true }}
      rewardMessage="포인트 확인에 실패했어요." rewardRetry onRetryReward={retryReward} />)

    const toast = screen.getByRole("status")
    expect(toast.querySelector(".saved-toast__detail")).toHaveTextContent("기분도 함께 저장됐어요.")
    expect(toast).toHaveTextContent("포인트 확인에 실패했어요.")
    fireEvent.click(within(toast).getByRole("button", { name: "포인트 다시 확인" }))
    expect(retryReward).toHaveBeenCalledOnce()
  })

  it("keeps review and storage failure guidance instead of a normal pain success statement", () => {
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "pain", savedDate: "2026-10-18", moodAlsoSaved: false }}
      reviewMessage="기록 확인이 필요해요." storageMessage="계정 저장에 실패했어요." onOpenTrends={vi.fn()} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("계정 저장에 실패했어요.")
    expect(alert.querySelector(".saved-toast__detail")).toHaveTextContent("기록 확인이 필요해요.")
    expect(alert).not.toHaveTextContent("통증 기록이 저장됐어요")
    expect(within(alert).queryByRole("button", { name: "통증 추이 보기" })).toBeNull()
  })

  it.each([
    [{ kind: "distance" as const, savedDate: "2026-10-18", distanceKm: 3 }, "직접 입력한 거리만 기록했어요."],
    [{ kind: "generic" as const, savedDate: "2026-10-18" }, "온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요"],
  ])("keeps non-redundant detail for %s", (receipt, detail) => {
    render(<SavedToast count={0} phase="enter" receipt={receipt} />)
    expect(screen.getByRole("status").querySelector(".saved-toast__detail")).toHaveTextContent(detail)
  })

  it("lets the user dismiss an ordinary receipt immediately", () => {
    const dismiss = vi.fn()
    render(<SavedToast count={1} phase="enter" receipt={{ kind: "generic", savedDate: "2026-10-06" }} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole("button", { name: "저장 안내 닫기" }))
    expect(dismiss).toHaveBeenCalledOnce()
  })
  it("offers decoration after a real dated save without opening it automatically", () => {
    const decorate = vi.fn()
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "generic", savedDate: "2026-10-02" }} onDecorateSaved={decorate} />)
    expect(decorate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    expect(decorate).toHaveBeenCalledOnce()
  })
  it.each([undefined, "검토가 필요한 기록이에요."])("does not advertise decoration without a saved date or ahead of review guidance", reviewMessage => {
    render(<SavedToast count={0} phase="enter" receipt={reviewMessage ? { kind: "generic", savedDate: "2026-10-02" } : { kind: "generic" }} reviewMessage={reviewMessage} onDecorateSaved={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "일지 꾸미기" })).toBeNull()
  })
  it("names the selected future journal date instead of calling it today", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00"))
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "generic", savedDate: "2026-09-08" }} />)

    expect(screen.getByRole("status")).toHaveTextContent("9월 8일 기록을 남겼어요.")
    expect(screen.getByRole("status")).toHaveAttribute("data-toast-priority", "receipt")
  })

  it("does not claim a future saved value is already in a current aggregation window", () => {
    vi.setSystemTime(new Date("2026-09-04T12:00:00"))
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "distance", savedDate: "2026-09-08", distanceKm: 3 }} />)

    const toast = screen.getByRole("status")
    expect(toast).toHaveTextContent("9월 8일 3 km를 저장했어요")
    expect(toast).not.toHaveTextContent("이번 주")
    expect(toast).not.toHaveTextContent("반영")
  })

  it("calls the saved date today only when the local calendar date matches", () => {
    vi.setSystemTime(new Date("2026-09-08T12:00:00"))
    render(<SavedToast count={0} phase="enter" receipt={{ kind: "generic", savedDate: "2026-09-08" }} />)
    expect(screen.getByRole("status")).toHaveTextContent("오늘 기록을 남겼어요.")
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

  it("keeps review-required save guidance persistent and explicitly dismissible", () => {
    render(
      <SavedToast
        count={1}
        phase="enter"
        reviewMessage="확인이 필요한 기록이에요."
        onDismiss={() => undefined}
      />,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveAttribute("data-toast-priority", "review")
    expect(alert).toHaveTextContent("확인이 필요한 기록이에요.")
    expect(within(alert).getByRole("button", { name: "검토 안내 닫기" })).toBeVisible()
  })
})
