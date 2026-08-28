import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TrainingContent, TrainingContentCorrectionNotice } from "./TrainingContent"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("training content reader", () => {
  it("shows source status and the no-auto-plan boundary before opening an article", () => {
    render(<TrainingContent onBack={vi.fn()} />)

    expect(screen.getByRole("heading", { name: /유행 이름보다/u })).toBeVisible()
    expect(screen.getByText(/내 계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: /노르웨이식 더블 스레숄드/u })).toHaveTextContent("추가 검토 중인 기사")
    expect(screen.getByRole("button", { name: /크루즈 인터벌/u })).toHaveTextContent("원문 확인 자료")
    expect(screen.getByText(/콘텐츠 포인트는 기존 포인트와 합치는 규칙/u)).toBeVisible()
  })

  it("opens an article, saves it locally, and keeps the prescription boundary visible", () => {
    render(<TrainingContent onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /크루즈 인터벌은 지속주와/u }))

    expect(screen.getByRole("heading", { name: "따라 하기 전에" })).toBeVisible()
    expect(screen.getByText(/계획의 페이스나 반복 수를 정하지 않아요/u)).toBeVisible()
    expect(screen.getByRole("link", { name: /VDOT Threshold/u })).toHaveAttribute("rel", "noreferrer")

    const save = screen.getByRole("button", { name: "나중에 읽기" })
    fireEvent.click(save)
    expect(screen.getByRole("button", { name: "저장됨" })).toHaveAttribute("aria-pressed", "true")
  })
})

describe("training content correction notice", () => {
  it("shows an explicit correction without changing the article body", () => {
    render(<TrainingContentCorrectionNotice notice="출처 날짜를 2026년 8월 28일로 바로잡았어요." />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "정정 안내 · 출처 날짜를 2026년 8월 28일로 바로잡았어요.",
    )
  })

  it("renders nothing when no correction exists", () => {
    const { container } = render(<TrainingContentCorrectionNotice notice={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
