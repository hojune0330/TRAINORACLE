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

it("makes the user's profile the subject and keeps Mari in a separate manager area", () => {
  render(<OracleProfileExperience {...props({ answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, selectedCharacter: "STRUCTURE" })} />)
  const self = screen.getByRole("region", { name: "나의 러닝 프로필" })
  expect(within(self).getByRole("heading", { name: "계획을 즐기는 러너" })).toBeVisible()
  expect(within(self).getByRole("meter", { name: "계획 선호" })).toHaveAttribute("aria-valuenow", "100")
  expect(within(self).queryByRole("img")).toBeNull()
  expect(within(self).queryByText("마리 매니저")).toBeNull()
  const manager = screen.getByRole("complementary", { name: "마리 매니저" })
  expect(within(manager).getByRole("img")).toHaveAttribute("src", expect.stringContaining("mari-analysis.png"))
  expect(within(manager).getByText(/실제 훈련 횟수나 능력을 뜻하지는/)).toBeVisible()
})
it("chooses Mari's work portrait by context, not by the user's preference type", () => {
  const { rerender } = render(<OracleProfileExperience {...props()} />)
  expect(within(screen.getByRole("complementary")).getByRole("img")).toHaveAttribute("src", expect.stringContaining("mari-wave.png"))
  for (const axis of ["STRUCTURE", "SOCIAL", "REFRESH"] as const) {
    rerender(<OracleProfileExperience {...props({ answers: { [`${axis}_1`]: 5, [`${axis}_2`]: 5, [`${axis}_3`]: 5 }, selectedCharacter: axis })} />)
    expect(within(screen.getByRole("complementary")).getByRole("img")).toHaveAttribute("src", expect.stringContaining("mari-analysis.png"))
  }
})
it("opens real record and plan readings from the manager and returns to the same profile", () => {
  const readTopic = vi.fn((id: string) => ({ state: "READY" as const, facts: [{ label: "확인한 자료", value: id === "B02" ? "800m · 2:08" : id === "C02" ? "기록된 훈련 · 3회" : "당시 목표 · 200m 32초", source: "합성 시험 자료" }], paragraphs: [], limitations: [] }))
  render(<OracleProfileExperience {...props({ readTopic, answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, selectedCharacter: "STRUCTURE" })} />)
  fireEvent.click(within(screen.getByRole("complementary")).getByRole("button", { name: "내 기록 해설" }))
  expect(readTopic).toHaveBeenLastCalledWith("B02", { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 })
  expect(within(dialog()).getByText("800m · 2:08")).toBeInTheDocument()
  fireEvent.click(within(dialog()).getByRole("button", { name: "닫기", hidden: true }))
  expect(screen.getByRole("heading", { name: "계획을 즐기는 러너" })).toBeVisible()
  fireEvent.click(within(screen.getByRole("complementary")).getByRole("button", { name: "계획·수행 비교" }))
  expect(readTopic).toHaveBeenLastCalledWith("C07", { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 })
  expect(within(dialog()).getByText("당시 목표 · 200m 32초")).toBeInTheDocument()
  fireEvent.click(within(dialog()).getByRole("button", { name: "닫기", hidden: true }))
  fireEvent.click(within(screen.getByRole("complementary")).getByRole("button", { name: "내 훈련 해설" }))
  expect(readTopic).toHaveBeenLastCalledWith("C02", { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 })
  expect(within(dialog()).getByText("기록된 훈련 · 3회")).toBeInTheDocument()
})
it("does not invent a personal training analysis for an empty or loading profile", () => {
  const { rerender } = render(<OracleProfileExperience {...props()} />)
  expect(screen.queryByRole("meter")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "계획·수행 비교" }))
  expect(within(dialog()).getByText("입력한 자료가 없어요.")).toBeInTheDocument()
  expect(within(dialog()).queryByText(/체력|능력.*점|회복력/)).toBeNull()
  fireEvent.click(within(dialog()).getByRole("button", { name: "닫기", hidden: true }))
  rerender(<OracleProfileExperience {...props({ account: true, status: "LOADING" })} />)
  expect(within(screen.getByRole("complementary")).getByText("계정의 응답을 확인하는 중이에요.")).toBeVisible()
  expect(screen.queryByRole("button", { name: "내 취향 풀이" })).toBeNull()
})
it("keeps the manager's preference explanation tied to the selected result", () => {
  render(<OracleProfileExperience {...props({ answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, selectedCharacter: "STRUCTURE" })} />)
  fireEvent.click(within(screen.getByRole("region", { name: "나의 러닝 프로필" })).getByRole("button", { name: "계획 선호", exact: true }))
  expect(dialog()).toHaveAttribute("aria-label", "마리의 응답 해설")
  expect(within(dialog()).getByText("마리 매니저 · 내 응답 기준")).toBeInTheDocument()
  expect(within(dialog()).getByText(/세 문항의 응답을 정리한 100점/)).toBeInTheDocument()
})

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
