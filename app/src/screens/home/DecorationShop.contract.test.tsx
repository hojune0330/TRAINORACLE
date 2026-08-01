import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DecorationShop } from "./DecorationShop"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("decoration shop surface", () => {
  it("shows all three decoration categories and never suggests cash value", () => {
    render(<DecorationShop earnedPoints={20} />)

    expect(screen.getByText("하늘 일지 테마")).toBeVisible()
    expect(screen.getByText("결승선 스티커")).toBeVisible()
    expect(screen.getByText("출발선 아바타")).toBeVisible()
    expect(screen.getByText(/현금으로 바꾸거나 다른 사람에게 보낼 수 없어요/u)).toBeVisible()
  })

  it("keeps a purchased item after reopening the shop", async () => {
    const first = render(<DecorationShop earnedPoints={20} />)
    await userEvent.click(screen.getByRole("button", { name: "결승선 스티커 8P로 받기" }))
    expect(screen.getByText("보유 중")).toBeVisible()

    first.unmount()
    render(<DecorationShop earnedPoints={20} />)
    expect(screen.getByText("보유 중")).toBeVisible()
  })
})
