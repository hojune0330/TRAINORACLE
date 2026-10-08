import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TrainingContent, TrainingContentCorrectionNotice } from "./TrainingContent"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("training content reader", () => {
  it("shows topics and source status first and keeps the reading boundary available on demand", () => {
    const { container } = render(<TrainingContent onBack={vi.fn()} />)

    const title = screen.getByRole("heading", { level: 1, name: "어떤 훈련이 궁금한가요?" })
    expect(title).toBeVisible()
    expect(title).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(container.querySelector('img[src$="running-shoe-v2.webp"]')).toHaveAttribute("width", "64")
    expect(screen.getByRole("button", { name: /노르웨이식 더블 스레숄드/u })).toHaveTextContent("추가 검토 중인 기사")
    expect(screen.getByRole("button", { name: /크루즈 인터벌/u })).toHaveTextContent("원문 확인 자료")
    const help = screen.getByText("훈련 자료와 읽기 포인트 안내")
    expect(help.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(help)
    expect(screen.getByText(/읽거나 저장해도/u)).toBeVisible()
  })

  it("opens an article, saves it locally, and keeps the prescription boundary visible", () => {
    const { container } = render(<TrainingContent onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /크루즈 인터벌은 지속주와/u }))

    expect(container.querySelector('img[src$="running-shoe-v2.webp"]')).toBeNull()
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    const boundary = screen.getByRole("heading", { level: 2, name: "따라 하기 전에" })
    expect(boundary).toBeVisible()
    expect(boundary).toHaveClass("app-heading--section")
    for (const heading of screen.getAllByRole("heading", { level: 2 })) {
      expect(heading).toHaveClass("app-heading--section")
      expect(heading).not.toHaveClass("app-heading--accent")
    }
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
