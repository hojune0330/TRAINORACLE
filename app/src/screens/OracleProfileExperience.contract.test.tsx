import React from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleProfileExperience, type OracleProfileExperienceProps } from "./OracleProfileExperience"
import { ORACLE_CONTENT_CATALOG } from "../domain/oracle-content-catalog"

vi.mock("../hooks/useReaderDialog", () => ({ useReaderDialog: (_ref: unknown, close: () => void) => close }))
function props(extra: Partial<OracleProfileExperienceProps> = {}): OracleProfileExperienceProps {
  return { answers: {}, selectedCharacter: null, revision: 0, readings: [], account: false, status: "READY",
    readTopic: () => ({ state: "MISSING", facts: [], paragraphs: ["입력한 자료가 없어요."], limitations: ["없는 자료는 추측하지 않아요."] }),
    onDraft: vi.fn(), onCommit: vi.fn(async () => true), onRemember: vi.fn(async () => true),
    onDelete: vi.fn(async () => true), onRetry: vi.fn(), onBack: vi.fn(), onNavigate: vi.fn(), ...extra }
}
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") } })
afterEach(cleanup)
const dialog = () => screen.getByRole("dialog", { hidden: true })

it("asks one question at a time and only commits after the third response", async () => {
  const p = props(); render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
  for (let n = 0; n < 3; n++) {
    expect(within(dialog()).getAllByRole("heading", { hidden: true })).toHaveLength(1)
    fireEvent.click(within(dialog()).getByRole("button", { name: "매우 그래요", hidden: true }))
    if (n < 2) expect(p.onCommit).not.toHaveBeenCalled()
  }
  await waitFor(() => expect(p.onCommit).toHaveBeenCalledTimes(1))
  expect(p.onDraft).toHaveBeenCalledTimes(3)
  expect(p.onCommit).toHaveBeenCalledWith({ STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, "STRUCTURE")
})
it("preserves answers on save rejection and exposes the failure instead of success", async () => {
  const p = props({ account: true, onCommit: vi.fn(async () => false) }); render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
  for (let n = 0; n < 3; n++) fireEvent.click(within(dialog()).getByRole("button", { name: "매우 그래요", hidden: true }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("입력한 답은"))
  expect(within(dialog()).getByText("100")).toBeInTheDocument()
  fireEvent.click(within(dialog()).getByRole("button", { name: "다시 저장", hidden: true }))
  await waitFor(() => expect(p.onCommit).toHaveBeenCalledTimes(2))
})
it("reopens an edited complete-axis draft from its first question without confirming it", () => {
  const answers = { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 } as const
  const p = props({ answers, draftAnswers: { ...answers, STRUCTURE_1: 1 } })
  render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByRole("button", { name: "작성하던 답 이어가기" }))
  expect(within(dialog()).getByText("1 / 3")).toBeInTheDocument()
  expect(p.onCommit).not.toHaveBeenCalled()
})
it("lets a user keep a neutral character despite an eligible candidate", async () => {
  const p = props({ answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, selectedCharacter: "STRUCTURE" })
  render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByText("대표 별명 선택"))
  fireEvent.click(screen.getByRole("button", { name: "별명 없이 보기" }))
  await waitFor(() => expect(p.onCommit).toHaveBeenCalledWith(p.answers, null))
})
it("does not offer a fake zero score for skipped responses", async () => {
  render(<OracleProfileExperience {...props()} />)
  fireEvent.click(screen.getByRole("button", { name: "3문항으로 알아보기" }))
  for (let n = 0; n < 3; n++) fireEvent.click(within(dialog()).getByRole("button", { name: "건너뛰기", hidden: true }))
  await waitFor(() => expect(within(dialog()).getByText("아직 점수로 정리하지 않은 응답")).toBeInTheDocument())
  expect(within(dialog()).queryByText("0")).toBeNull()
})
it("exposes every topic in its group without inventing personal facts", () => {
  render(<OracleProfileExperience {...props()} />)
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  const names = ["취향", "경기 기록", "훈련", "훈련법", "함께", "대회", "돌아보기", "배우기"]
  names.forEach((name, i) => {
    fireEvent.click(within(screen.getByRole("group", { name: "읽을거리 주제" })).getByRole("button", { name }))
    const topics = ORACLE_CONTENT_CATALOG.filter(topic => topic.group === String.fromCharCode(65 + i))
    topics.forEach(topic => expect(screen.getByRole("button", { name: topic.title })).toBeVisible())
  })
})
it("keeps the originating topic when opening and closing a learning reader", () => {
  render(<OracleProfileExperience {...props()} />)
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  fireEvent.click(screen.getByRole("button", { name: "배우기" }))
  fireEvent.click(screen.getByRole("button", { name: "한 문제로 배우기" }))
  fireEvent.click(within(dialog()).getByRole("button", { name: "문제 풀기", hidden: true }))
  const learning = document.querySelector<HTMLDialogElement>('dialog[aria-label="오라클 배움"]')!
  expect(document.querySelector('dialog[aria-label="한 문제로 배우기"]')).toBeInTheDocument()
  fireEvent.click(within(learning).getByRole("button", { name: "닫기", hidden: true }))
  expect(document.querySelector('dialog[aria-label="오라클 배움"]')).toBeNull()
  expect(document.querySelector('dialog[aria-label="한 문제로 배우기"]')).toBeInTheDocument()
})
it("does not discard a topic when its linked records view is opened", () => {
  const p = props(); render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  fireEvent.click(screen.getByRole("button", { name: "경기 기록" }))
  const topic = ORACLE_CONTENT_CATALOG.find(item => item.group === "B" && item.destination === "RECORDS")!
  fireEvent.click(screen.getByRole("button", { name: topic.title }))
  fireEvent.click(within(dialog()).getByRole("button", { name: "경기 기록 보기", hidden: true }))
  expect(p.onNavigate).toHaveBeenCalledWith("RECORDS")
  expect(dialog()).toHaveAttribute("aria-label", topic.title)
})
it("labels A03's calendar destination accurately and keeps its originating topic open", () => {
  const p = props(); render(<OracleProfileExperience {...p} />)
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  const topic = ORACLE_CONTENT_CATALOG.find(item => item.id === "A03")!
  fireEvent.click(screen.getByRole("button", { name: topic.title }))
  const origin = dialog()
  expect(within(origin).queryByRole("button", { name: "계획 보기", hidden: true })).toBeNull()
  fireEvent.click(within(origin).getByRole("button", { name: "달력 보기", hidden: true }))
  expect(p.onNavigate).toHaveBeenCalledExactlyOnceWith("CALENDAR")
  expect(dialog()).toBe(origin)
  expect(origin).toHaveAttribute("aria-label", topic.title)
})
it("clears a failed bookmark message when retry succeeds", async () => {
  const onRemember = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  render(<OracleProfileExperience {...props({ account: true, answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, onRemember })} />)
  fireEvent.click(screen.getByRole("button", { name: "이 결과 보관" }))
  await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
  fireEvent.click(screen.getByRole("button", { name: "이 결과 보관" }))
  await waitFor(() => expect(onRemember).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole("alert")).toBeNull()
})
