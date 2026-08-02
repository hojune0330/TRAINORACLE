// 오류 경계 계약 테스트.
//
// 핵심 계약: 화면이 깨져도 사용자가 **자기 일지에 닿을 수 있어야 한다.**
// 흰 화면이 되면 기기에만 있는 기록에 접근할 방법이 사라진다.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { ErrorBoundary } from "./ErrorBoundary"

const JOURNAL_KEY = "trainoracle.journal.v1"

function Boom(): React.ReactElement {
  throw new Error("의도적 렌더 실패")
}

beforeEach(() => {
  window.localStorage.clear()
  // React가 경계 테스트에서 콘솔에 찍는 오류를 잠시 가린다
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ErrorBoundary", () => {
  it("정상일 때는 자식을 그대로 보여준다", () => {
    render(<ErrorBoundary><p>정상 화면</p></ErrorBoundary>)
    expect(screen.getByText("정상 화면")).toBeTruthy()
  })

  it("렌더가 깨져도 흰 화면이 되지 않는다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId("error-boundary")).toBeTruthy()
    expect(screen.getByText(/문제가 생겼어요/u)).toBeTruthy()
  })

  it("일지가 남아 있다는 사실과 개수를 알려준다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "a" }, { id: "b" }, { id: "c" }]))
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    // 사용자가 가장 먼저 걱정하는 것은 "내 기록이 날아갔나"다
    expect(screen.getByText(/일지 3개는 이 기기에 그대로 있어요/u)).toBeTruthy()
  })

  it("오류 화면에서 바로 백업을 받을 수 있다", () => {
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ id: "a" }]))
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    // "다시 시도"만 있으면 같은 오류가 반복될 때 탈출구가 없다
    expect(screen.getByTestId("error-download-backup")).toBeTruthy()
  })

  it("다시 열어 보기 경로를 제공한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId("error-retry")).toBeTruthy()
  })

  it("오류 내용을 외부로 보내지 않는다고 명시한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText(/기기 밖으로 전송되지 않아요/u)).toBeTruthy()
  })

  it("GitHub 대신 앱 안의 문의 게시판으로 안내한다", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    const link = screen.getByRole("link", { name: "문의 게시판에 알리기" })
    expect(link).toHaveAttribute("href", "?feedback=1")
  })
})
