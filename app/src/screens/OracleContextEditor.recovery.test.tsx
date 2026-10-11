import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleContextEditor } from "./OracleContextEditor"

vi.mock("../hooks/useReaderDialog", () => ({ useReaderDialog: (ref: React.RefObject<HTMLDialogElement>, close: () => void) => {
  React.useEffect(() => { ref.current?.showModal() }, [ref]); return close
} }))
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") } })
afterEach(cleanup)
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
