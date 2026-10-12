import React from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OracleLearningReader } from "./OracleLearningReader"
import { ORACLE_EVIDENCE_PAGES, ORACLE_LEARNING_QUIZ, ORACLE_LEARNING_TITLES, ORACLE_SYNTHETIC_NOTICE,
  type OracleLearningDestination } from "../domain/oracle-learning-content"

afterEach(cleanup)
const next = () => fireEvent.click(screen.getByRole("button", { name: "다음 학습 페이지" }))

describe("OracleLearningReader content-only destinations", () => {
  it.each(Object.keys(ORACLE_LEARNING_TITLES) as OracleLearningDestination[])("renders %s without owning a dialog or close lifecycle", destination => {
    const onBack = vi.fn()
    render(<OracleLearningReader destination={destination} onBack={onBack} />)
    expect(screen.getByRole("article", { name: ORACLE_LEARNING_TITLES[destination] })).toBeVisible()
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("button", { name: "이전 학습 페이지" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }))
    expect(onBack).toHaveBeenCalledTimes(1)
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("type", "button")
  })
  it("pages glossary content, focuses the new heading, and bounds previous and next", async () => {
    render(<OracleLearningReader destination="GLOSSARY" onBack={vi.fn()} />)
    expect(screen.getByRole("heading")).toHaveTextContent("주요 훈련")
    next()
    await waitFor(() => expect(screen.getByRole("heading")).toHaveFocus())
    expect(screen.getByRole("heading")).toHaveTextContent("지속 페이스")
    for (let n = 0; n < 4; n++) next()
    expect(screen.getByRole("button", { name: "다음 학습 페이지" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "이전 학습 페이지" }))
    expect(screen.getByRole("heading")).toHaveTextContent("훈련표 읽는 법")
  })
  it("shows exact source URLs, grades and discovery limitations, including watch access scope", () => {
    render(<OracleLearningReader destination="EVIDENCE" onBack={vi.fn()} />)
    for (const [index, page] of ORACLE_EVIDENCE_PAGES.entries()) {
      if (index) next()
      expect(screen.getByRole("heading")).toHaveTextContent(page.title)
      for (const source of page.sources ?? []) {
        const link = screen.getByRole("link", { name: new RegExp(source.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
        expect(link).toHaveAttribute("href", source.url)
        expect(link).toHaveAttribute("rel", "noopener noreferrer")
        expect(link).toHaveAccessibleName(expect.stringContaining("새 창"))
        if (source.grade) expect(screen.getByText(new RegExp(source.grade))).toBeVisible()
        if (source.scope) expect(screen.getByText(source.scope)).toBeVisible()
        if (source.state === "DISCOVERY_SOURCE_ONLY") expect(screen.getByText(/추가 검토 중인 기사/)).toBeVisible()
      }
    }
  })
  it("requires an explicit choice to check, gives incorrect and correct feedback, and retains back navigation", () => {
    render(<OracleLearningReader destination="QUIZ" onBack={vi.fn()} />)
    expect(screen.getByRole("button", { name: "답 확인" })).toBeDisabled()
    fireEvent.click(screen.getByRole("radio", { name: ORACLE_LEARNING_QUIZ[0]!.choices[0] }))
    fireEvent.click(screen.getByRole("button", { name: "답 확인" }))
    expect(screen.getByRole("status")).toHaveTextContent("다시 살펴볼까요?")
    expect(screen.getByRole("status")).toHaveTextContent("날짜 1일 · 세션 2회 · 8km")
    next()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole("radio", { name: "5회" }))
    fireEvent.click(screen.getByRole("button", { name: "답 확인" }))
    expect(screen.getByRole("status")).toHaveTextContent("맞아요.")
    expect(screen.getByRole("status")).toHaveTextContent("회복 준수 여부는 알 수 없어요")
    fireEvent.click(screen.getByRole("button", { name: "이전 학습 페이지" }))
    expect(screen.getByRole("status")).toHaveTextContent("다시 살펴볼까요?")
    expect(screen.getByRole("radio", { name: ORACLE_LEARNING_QUIZ[0]!.choices[0] })).toBeChecked()
  })
  it("allows skipping, finishes without an ability score, and restarts with no retained answers", () => {
    render(<OracleLearningReader destination="QUIZ" onBack={vi.fn()} />)
    next(); next()
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 마치기" }))
    expect(screen.getByRole("heading")).toHaveTextContent("문제 풀이를 마쳤어요")
    expect(screen.getByText(/신체 능력이나 훈련 수준 평가가 아니에요/)).toBeVisible()
    expect(screen.queryByRole("radio")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }))
    expect(screen.getByRole("button", { name: "답 확인" })).toBeDisabled()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })
  it("resets internal state when destination changes without depending on a parent key", () => {
    const { rerender } = render(<OracleLearningReader destination="QUIZ" onBack={vi.fn()} />)
    next()
    rerender(<OracleLearningReader destination="EXAMPLE" onBack={vi.fn()} />)
    expect(screen.getByRole("heading")).toHaveTextContent("같은 날")
    rerender(<OracleLearningReader destination="QUIZ" onBack={vi.fn()} />)
    expect(screen.getByRole("heading")).toHaveTextContent(ORACLE_LEARNING_QUIZ[0]!.question)
    expect(screen.getByRole("button", { name: "답 확인" })).toBeDisabled()
  })
  it("labels synthetic examples and provides an accessible table including the 94-second boundary", () => {
    render(<OracleLearningReader destination="EXAMPLE" onBack={vi.fn()} />)
    expect(screen.getByText(ORACLE_SYNTHETIC_NOTICE)).toBeVisible()
    expect(screen.getByRole("table", { name: "가상 일지의 두 세션" })).toBeVisible()
    next()
    const table = screen.getByRole("table", { name: "가상 반복 기록 · 목표 90~94초" })
    expect(within(table).getAllByRole("row")).toHaveLength(7)
    expect(within(table).getByRole("row", { name: "4회 94초 범위 안" })).toBeVisible()
    expect(screen.getByText(/회복 준수 여부는 미확인/)).toBeVisible()
  })
  it("never writes storage or requests network while answering and paging", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem")
    const fetch = vi.spyOn(globalThis, "fetch")
    render(<OracleLearningReader destination="QUIZ" onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: ORACLE_LEARNING_QUIZ[0]!.choices[1] }))
    fireEvent.click(screen.getByRole("button", { name: "답 확인" }))
    next(); next()
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 마치기" }))
    expect(storage).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
