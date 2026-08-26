import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DECORATION_STORAGE_KEY_V2, parseStoredDecorationState } from "../../domain/decorations"
import { todayISO } from "../../domain/journal-store"
import { DecorationShop } from "./DecorationShop"
import { moveDecorationDate } from "./decoration-studio-model"

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("decoration shop surface", () => {
  it("PIN: shows the exact zero-point balance in the current shop summary", () => {
    render(<DecorationShop earnedPoints={0} />)

    expect(screen.getByText("일지 꾸미기 · 사용 가능 0P")).toBeVisible()
  })

  it("keeps the first-record entry compact until a journal page exists", () => {
    render(<DecorationShop earnedPoints={0} showPreview={false} />)

    expect(screen.getByRole("button", { name: "꾸미기 열기" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "꾸미기 미리보기" })).toBeNull()
  })

  it("shows eight visual previews including five starter items and never suggests cash value", () => {
    const { container } = render(<DecorationShop earnedPoints={20} />)
    fireEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))

    expect(screen.getByText("트랙 노트")).toBeVisible()
    expect(screen.getByText("남색 잉크")).toBeVisible()
    expect(screen.getByText("맑은 날")).toBeVisible()
    expect(screen.getByText("푹 쉬었어요")).toBeVisible()
    expect(screen.getByText("체크 테이프")).toBeVisible()
    expect(screen.getByText("하늘 일지 테마")).toBeVisible()
    expect(screen.getByText("결승선 스티커")).toBeVisible()
    expect(screen.getByText("출발선 아바타")).toBeVisible()
    expect(container.querySelectorAll(".decoration-shop__item img")).toHaveLength(8)
    expect(screen.getByRole("button", { name: "트랙 노트 사용 중" })).toBeVisible()
    expect(screen.getByRole("button", { name: "남색 잉크 사용 중" })).toBeVisible()
    expect(screen.getByRole("button", { name: "맑은 날 바로 사용" })).toBeVisible()
    expect(screen.getByRole("button", { name: "푹 쉬었어요 바로 사용" })).toBeVisible()
    expect(screen.getByRole("button", { name: "체크 테이프 바로 사용" })).toBeVisible()
    expect(screen.getByRole("button", { name: "하늘 일지 테마 12P로 받기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "출발선 아바타 20P로 받기" })).toBeVisible()
    expect(screen.getByText(/현금으로 바꾸거나 다른 사람에게 보낼 수 없어요/u)).toBeVisible()
  })

  it("shows a named fallback when an asset cannot load", () => {
    const { container } = render(<DecorationShop earnedPoints={20} />)
    fireEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    const firstPreview = container.querySelector(".decoration-shop__item img")
    expect(firstPreview).not.toBeNull()
    if (firstPreview === null) return

    fireEvent.error(firstPreview)

    expect(screen.getByRole("img", { name: "트랙 노트 미리보기" })).toBeVisible()
  })

  it("keeps a purchased item after reopening the shop", async () => {
    const first = render(<DecorationShop earnedPoints={20} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))
    expect(screen.getByRole("button", { name: "결승선 스티커 사용하기" })).toBeVisible()

    first.unmount()
    render(<DecorationShop earnedPoints={20} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    expect(screen.getByRole("button", { name: "결승선 스티커 사용하기" })).toBeVisible()
  })

  it("reports spent points to the home balance after a verified purchase", async () => {
    let spentPoints = 0
    render(<DecorationShop earnedPoints={20} onSpentPointsChange={(spent) => { spentPoints = spent }} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))

    expect(spentPoints).toBe(8)
  })

  it("does not claim success when purchase storage silently fails", async () => {
    render(<DecorationShop earnedPoints={20} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    await userEvent.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))

    expect(screen.getByRole("status")).toHaveTextContent("저장하지 못했어요. 다시 시도해 주세요.")
    expect(screen.queryByText(/받았어요/u)).toBeNull()
  })

  it("states the exact shortfall and safe ways to earn it", async () => {
    render(<DecorationShop earnedPoints={4} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))

    expect(screen.getByRole("status")).toHaveTextContent("포인트가 4P 더 필요해요.")
    expect(screen.getByRole("status")).toHaveTextContent("오늘 방문 확인은 1P")
    expect(screen.getByRole("status")).toHaveTextContent("훈련·회복 기록을 남긴 날은 4P")
  })

  it("keeps viewing simple until the palette opens the studio", async () => {
    render(<DecorationShop earnedPoints={0} />)

    expect(screen.getByText("보기")).toBeVisible()
    expect(screen.queryByRole("tab", { name: "추천 조합" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))

    for (const name of ["추천 조합", "최근 사용", "즐겨찾기", "날씨", "회복", "경기", "계절", "모두"]) {
      expect(screen.getByRole("tab", { name })).toBeVisible()
    }
    for (const name of ["가벼운 날", "회복한 날", "비 오는 날", "경기 날"]) {
      expect(screen.getByRole("button", { name: `${name} 미리보기` })).toBeVisible()
    }
  })

  it("tries an unowned item without changing storage and restores the page when closed", async () => {
    render(<DecorationShop earnedPoints={0} />)
    const before = window.localStorage.getItem("trainoracle.decorations.v2")
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))

    await userEvent.click(screen.getByRole("button", { name: "하늘 일지 테마 미리보기" }))

    expect(screen.getByRole("region", { name: "꾸미기 미리보기" })).toHaveTextContent("하늘 일지 테마 미리보기 중")
    expect(window.localStorage.getItem("trainoracle.decorations.v2")).toBe(before)

    await userEvent.click(screen.getByRole("button", { name: "꾸미기 닫기" }))

    expect(screen.queryByText("하늘 일지 테마 미리보기 중")).toBeNull()
    expect(window.localStorage.getItem("trainoracle.decorations.v2")).toBe(before)
  })

  it("lets a zero-point user apply a starter and keeps favorites and recents after reopening", async () => {
    const first = render(<DecorationShop earnedPoints={0} hasEntriesForDate={() => true} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("button", { name: "맑은 날 즐겨찾기" }))
    await userEvent.click(screen.getByRole("button", { name: "맑은 날 바로 사용" }))

    expect(screen.getByRole("status")).toHaveTextContent("맑은 날을 사용했어요.")
    first.unmount()

    render(<DecorationShop earnedPoints={0} hasEntriesForDate={() => true} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("tab", { name: "최근 사용" }))
    expect(screen.getByRole("button", { name: "맑은 날 사용 중" })).toBeVisible()
    await userEvent.click(screen.getByRole("tab", { name: "즐겨찾기" }))
    expect(screen.getByRole("button", { name: "맑은 날 즐겨찾기 해제" })).toBeVisible()
  })

  it("does not claim a starter was applied when verified storage fails", async () => {
    render(<DecorationShop earnedPoints={0} hasEntriesForDate={() => true} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    await userEvent.click(screen.getByRole("button", { name: "맑은 날 바로 사용" }))

    expect(screen.getByRole("status")).toHaveTextContent("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
    expect(screen.queryByText("맑은 날을 사용했어요.")).toBeNull()
  })

  it("saves a starter only for the explicitly selected previous date", () => {
    render(<DecorationShop earnedPoints={0} hasEntriesForDate={() => true} />)
    const today = todayISO()
    const previousDate = moveDecorationDate(today, -1)
    const before = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    const beforeState = parseStoredDecorationState(before ?? "")

    fireEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    fireEvent.click(screen.getByTestId("decoration-date-previous"))
    fireEvent.click(screen.getByTestId("decoration-preset-LIGHT_DAY"))

    expect(screen.getByTestId("decoration-date-current")).toHaveTextContent(previousDate)
    expect(screen.getByText("조합 미리보기")).toBeVisible()
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(before)

    fireEvent.click(screen.getByTestId("decoration-item-use-STICKER_WEATHER_SUN"))

    const after = window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)
    const afterState = parseStoredDecorationState(after ?? "")
    expect(JSON.stringify(afterState?.pagePlacements.filter((placement) => placement.date === today))).toBe(
      JSON.stringify(beforeState?.pagePlacements.filter((placement) => placement.date === today)),
    )
    expect(afterState?.pagePlacements).toContainEqual({
      date: previousDate,
      slot: "TOP_CORNER",
      itemId: "STICKER_WEATHER_SUN",
    })
  })

  it("does not save a date decoration for an empty date", async () => {
    render(<DecorationShop earnedPoints={0} />)
    await userEvent.click(screen.getByRole("button", { name: "꾸미기 열기" }))
    await userEvent.click(screen.getByRole("button", { name: "맑은 날 미리보기" }))
    await userEvent.click(screen.getByTestId("decoration-item-use-STICKER_WEATHER_SUN"))

    expect(screen.getByRole("status")).toHaveTextContent("기록이 있는 날짜에만")
    expect(parseStoredDecorationState(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2) ?? "")?.pagePlacements).toEqual([])
  })
})
