import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

describe("more public documents", () => {
  it("keeps device status, legal documents, and sticker sources in the named app information view", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    expect(screen.getByRole("button", { name: /^기기 연동 상태/u })).toBeVisible()
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
    fireEvent.click(screen.getByRole("button", { name: /^기기 연동 상태/u }))
    expect(screen.getByRole("heading", { name: "기기 연동 상태", level: 1 })).toBeVisible()
    expect(screen.getByText("이 앱 버전에서는 기기 계정 연결을 제공하지 않아요.")).toBeVisible()
    expect(screen.queryByRole("link", { name: /^기기 연동 상태/u })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "앱 정보로 돌아가기" }))
    expect(screen.getByRole("heading", { name: "앱 정보·개인정보·문의", level: 1 })).toBeVisible()
  })
})
