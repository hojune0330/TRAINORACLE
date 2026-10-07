import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

describe("more public documents", () => {
  it("keeps device status, legal documents, and sticker sources in the named app information view", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    expect(screen.getByRole("link", { name: /^기기 연동 상태/u })).toHaveAttribute(
      "href",
      "./support.html",
    )
    expect(screen.getByText("Garmin · COROS")).toBeVisible()
    expect(screen.getByRole("link", { name: /^개인정보처리방침/u })).toHaveAttribute(
      "href",
      "./legal/privacy.html",
    )
    expect(screen.getByRole("link", { name: /^이용약관/u })).toHaveAttribute(
      "href",
      "./legal/terms.html",
    )
    expect(screen.getByRole("link", { name: /^스티커·오픈소스 출처/u })).toHaveAttribute(
      "href",
      "./legal/open-source.html",
    )
  })
})
