import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

describe("more public documents", () => {
  it("keeps device status and both legal documents one tap away", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)

    expect(screen.getByRole("link", { name: /^기기 연동 상태/u })).toHaveAttribute(
      "href",
      "./support.html",
    )
    expect(screen.getByText("Garmin·COROS 신청 현황과 파일 가져오기를 확인해요")).toBeVisible()
    expect(screen.getByRole("link", { name: /^개인정보처리방침/u })).toHaveAttribute(
      "href",
      "./legal/privacy.html",
    )
    expect(screen.getByRole("link", { name: /^이용약관/u })).toHaveAttribute(
      "href",
      "./legal/terms.html",
    )
  })
})
