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
    expect(screen.getByText("로그인한 계정에 운동을 모아 둘 수 있어요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "COROS·애플·삼성은 어떻게 연결하나요?" }))
    expect(screen.getByLabelText("다른 기기 연결 제공 여부")).toHaveTextContent("COROS자동 연결 준비 중Apple 건강iOS 앱 연결 준비 중삼성 헬스 · Health ConnectAndroid 앱 연결 준비 중")
    expect(screen.queryByRole("button", { name: "Garmin 연결" })).toBeNull()
    expect(screen.queryByText("연결됨", { exact: true })).toBeNull()
    expect(screen.queryByRole("link", { name: /^기기 연동 상태/u })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "앱 정보로 돌아가기" }))
    expect(screen.getByRole("heading", { name: "앱 정보·개인정보·문의", level: 1 })).toBeVisible()
  })
})
