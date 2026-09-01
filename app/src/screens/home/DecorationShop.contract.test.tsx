import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptyDecorationState, decorationStateSchema, saveDecorationState } from "../../domain/decorations"
import { DecorationShop } from "./DecorationShop"

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/*
 * 2026-09-01 통합 계약: 홈 꾸미기 카드는 더 이상 자체 편집 화면을 열지 않는다.
 * 구형 홈 스튜디오는 실제 기록 대신 자리표시 문구를 그려 "쓴 글이 연동 안 된다"는
 * 혼란을 만들었다 — 이제 카드는 오늘 일지 상세의 진짜 편집기로 안내만 한다.
 */
describe("home decoration entry card", () => {
  it("PIN: shows the exact zero-point balance in the card summary", () => {
    render(<DecorationShop earnedPoints={0} />)

    expect(screen.getByText("꾸미기 보관함 · 사용 가능 0P")).toBeVisible()
  })

  it("subtracts persisted spending from the earned balance", () => {
    const spent = decorationStateSchema.parse({ ...createEmptyDecorationState(), spentPoints: 8 })
    expect(saveDecorationState(spent).ok).toBe(true)

    render(<DecorationShop earnedPoints={20} />)

    expect(screen.getByText("꾸미기 보관함 · 사용 가능 12P")).toBeVisible()
  })

  it("reports persisted spending back to the home balance", () => {
    const spent = decorationStateSchema.parse({ ...createEmptyDecorationState(), spentPoints: 8 })
    expect(saveDecorationState(spent).ok).toBe(true)
    let reported = -1

    render(<DecorationShop earnedPoints={20} onSpentPointsChange={(value) => { reported = value }} />)

    expect(reported).toBe(8)
  })

  it("hands off to the real journal editor instead of opening its own editing screen", async () => {
    const user = userEvent.setup()
    const onDecorateToday = vi.fn()
    render(<DecorationShop earnedPoints={4} hasJournalEntries onDecorateToday={onDecorateToday} />)

    expect(screen.getByText("내 기록에 꾸미기")).toBeVisible()
    expect(screen.getByText(/오늘 일지 위에서 바로 꾸며요/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "꾸미기 열기" }))

    expect(onDecorateToday).toHaveBeenCalledTimes(1)
    /* 자체 편집 다이얼로그·자리표시 미리보기는 존재하지 않는다. */
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("region", { name: "꾸미기 미리보기" })).toBeNull()
    expect(screen.queryByText(/꾸미기만 먼저 시험해 봐요/u)).toBeNull()
  })

  it("never suggests cash value for beta points", () => {
    render(<DecorationShop earnedPoints={20} hasJournalEntries />)

    expect(screen.getByText(/현금으로 바꾸거나 다른 사람에게 보낼 수 없어요/u)).toBeVisible()
  })

  it("keeps the first-record state compact and honest before any journal exists", () => {
    render(<DecorationShop earnedPoints={0} hasJournalEntries={false} onDecorateToday={() => undefined} />)

    expect(screen.getByText("첫 기록 뒤 시작")).toBeVisible()
    expect(screen.getByText(/일지를 하나 남기면 그 페이지 위에서 바로 꾸밀 수 있어요/u)).toBeVisible()
  })
})
