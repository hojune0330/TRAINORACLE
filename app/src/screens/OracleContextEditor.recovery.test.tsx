import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleContextEditor } from "./OracleContextEditor"
import { ORACLE_CONTEXT_QUESTIONS } from "../domain/oracle-profile-context"

vi.mock("../hooks/useReaderDialog", () => ({ useReaderDialog: (ref: React.RefObject<HTMLDialogElement>, close: () => void) => {
  React.useEffect(() => { ref.current?.showModal() }, [ref]); return close
} }))
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") } })
afterEach(cleanup)
it("opens questions at the top, preserves multiple-choice scrolling and restores the topic-list position", () => {
  const draft = vi.fn(), save = vi.fn(async () => true)
  render(<OracleContextEditor onDraft={draft} onSave={save} onClose={vi.fn()} />)
  const body = screen.getByRole("dialog").querySelector<HTMLElement>(".oracle-v2__reader-body")!
  body.scrollTop = 120
  fireEvent.click(screen.getByRole("button", { name: "어떤 이유로 달리나요?" }))
  expect(body.scrollTop).toBe(0)
  expect(screen.getByRole("heading", { name: "어떤 이유로 달리나요?" })).toHaveFocus()
  body.scrollTop = 180
  fireEvent.click(screen.getByRole("button", { name: "배움" }))
  expect(body.scrollTop).toBe(180)
  fireEvent.click(screen.getByRole("button", { name: "선택 완료" }))
  expect(body.scrollTop).toBe(120)
  fireEvent.click(screen.getByRole("button", { name: "더 알아보고 싶은 것은?" }))
  expect(body.scrollTop).toBe(0)
  fireEvent.click(screen.getByRole("button", { name: "답하지 않기" }))
  expect(body.scrollTop).toBe(120)
  fireEvent.click(screen.getByRole("button", { name: "함께" }))
  expect(body.scrollTop).toBe(0)
  expect(draft).toHaveBeenLastCalledWith(expect.objectContaining({ answers: { motivations: ["LEARN"] } }))
  expect(save).not.toHaveBeenCalled()
})
function openEvent() {
  fireEvent.click(screen.getByRole("button", { name: "대회" }))
  fireEvent.click(screen.getByRole("button", { name: "대회 일정·이동·비용" }))
}
it("commits the pending event on finish and keeps it when reopening with restored focus", () => {
  const draft = vi.fn(), save = vi.fn(async () => true)
  render(<OracleContextEditor onDraft={draft} onSave={save} onClose={vi.fn()} />)
  openEvent()
  expect(screen.getByRole("heading", { name: "대회 일정과 비용" })).toHaveFocus()
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-15" } })
  fireEvent.change(screen.getByLabelText("이동 시간 (분) · 선택"), { target: { value: "60" } })
  fireEvent.change(screen.getByLabelText("예상 비용 · 선택"), { target: { value: "15000" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 마치기" }))
  expect(screen.getByRole("heading", { name: "조금 더 나답게" })).toHaveFocus()
  expect(draft).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: { events: [expect.objectContaining({ date: "2026-10-15", travelMinutes: 60, cost: { amount: 15000, currency: "KRW" } })] } }))
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "대회 일정·이동·비용" }))
  expect(screen.getByText("2026-10-15")).toBeVisible()
  expect(screen.getByText(/이동 60분.*15,000 KRW/)).toBeVisible()
})
it("keeps invalid unfinished values visible rather than leaving or creating an empty event", () => {
  const close = vi.fn(), draft = vi.fn()
  render(<OracleContextEditor onDraft={draft} onSave={vi.fn(async () => true)} onClose={close} />)
  openEvent()
  fireEvent.change(screen.getByLabelText("이동 시간 (분) · 선택"), { target: { value: "60" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 마치기" }))
  expect(screen.getByRole("alert")).toBeVisible()
  expect(screen.getByLabelText("이동 시간 (분) · 선택")).toHaveValue(60)
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }))
  expect(close).not.toHaveBeenCalled()
  expect(draft).not.toHaveBeenCalled()
})

it("emphasizes completed multiple selection and explicitly clears it without saving or requiring an answer", () => {
  const questionIndex = ORACLE_CONTEXT_QUESTIONS.findIndex(candidate => candidate.multiple)
  const question = ORACLE_CONTEXT_QUESTIONS[questionIndex]
  if (!question) throw new Error("A multiple-choice question is required in the existing context questions")
  const topicIndex = [[0, 1, 4, 5], [2, 3, 10, 11], [6, 7], [8, 9, 12]].findIndex(indices => indices.includes(questionIndex))
  const topic = ["달리기", "함께", "보조 운동", "대회"][topicIndex]
  if (!topic) throw new Error("The existing multiple-choice fixture needs a visible topic")
  const draft = vi.fn(), save = vi.fn(async () => true)
  render(<OracleContextEditor onDraft={draft} onSave={save} onClose={vi.fn()} />)
  expect(screen.getByRole("button", { name: "응답 반영" })).toHaveClass("next-action")
  fireEvent.click(screen.getByRole("button", { name: topic }))
  fireEvent.click(screen.getByRole("button", { name: name => name.startsWith(question.title) }))
  const finish = screen.getByRole("button", { name: "선택 완료" })
  expect(finish).toBeEnabled()
  expect(finish).not.toHaveClass("next-action")
  expect(screen.getByRole("button", { name: "답하지 않기" })).toBeEnabled()
  const [value, label] = question.options[0]!
  fireEvent.click(screen.getByRole("button", { name: label }))
  expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
  expect(finish).toHaveClass("next-action")
  expect(screen.getByRole("button", { name: "선택 지우고 돌아가기" })).not.toHaveClass("next-action")
  fireEvent.click(finish)
  expect(draft).toHaveBeenLastCalledWith(expect.objectContaining({ answers: { [question.id]: [value] } }))
  fireEvent.click(screen.getByRole("button", { name: name => name.startsWith(question.title) }))
  fireEvent.click(screen.getByRole("button", { name: "선택 지우고 돌아가기" }))
  expect(screen.getByRole("heading", { name: "조금 더 나답게" })).toHaveFocus()
  expect(draft).toHaveBeenLastCalledWith(expect.objectContaining({ answers: {} }))
  fireEvent.click(screen.getByRole("button", { name: name => name.startsWith(question.title) }))
  expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false")
  expect(screen.getByRole("button", { name: "답하지 않기" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "선택 완료" })).toBeEnabled()
  expect(save).not.toHaveBeenCalled()
})
