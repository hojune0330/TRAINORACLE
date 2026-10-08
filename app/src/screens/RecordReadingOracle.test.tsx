import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RecordReadingOracle } from "./RecordReadingOracle"
import type { ReadingStage } from "../domain/record-reading-oracle"

afterEach(cleanup)
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
function Harness() {
  const [stages, setStages] = React.useState<ReadingStage[]>(["own-event"])
  return <RecordReadingOracle stage={stages[stages.length - 1]!} today="2026-10-01"
    onStageChange={stage => setStages(current => [...current, stage])}
    onBack={() => setStages(current => current.slice(0, -1))}
    onClose={vi.fn()} onOpenPlan={vi.fn()} />
}
async function ownReading() {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "5000m" }))
  await user.type(screen.getByRole("textbox", { name: "최고기록" }), "20:30")
  await user.click(screen.getByRole("button", { name: "나의 러닝 풀이 보기" }))
  return user
}

describe("record reading flow", () => {
  it("applies the app motion preference live without changing the current result", async () => {
    const user = await ownReading()
    try {
      act(() => {
        localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
        window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
      })
      expect(document.querySelector(".record-reading")).toHaveAttribute("data-reduced-motion", "true")
      await user.click(screen.getByRole("button", { name: "400m 평균" }))
      expect(screen.getByText("1분 38.4초", { exact: true })).toBeVisible()
      expect(screen.getByRole("heading", { name: "400m 평균 시간" })).toHaveFocus()
    } finally {
      act(() => {
        localStorage.removeItem("trainoracle.calendar-reduced-motion.v1")
        window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
      })
    }
  })
  it("names the task before event choices and keeps the illustration out of the time input", async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    expect(screen.getByRole("heading", { level: 1, name: "어떤 기록을 살펴볼까요?" })).toHaveFocus()
    expect(screen.getByText("최고기록을 1km·400m 평균 시간으로 살펴봐요.")).toBeVisible()
    expect(container.querySelector('.contextual-illustration[src$="record-stopwatch-v3.webp"]')).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "5000m" }))
    expect(screen.getByRole("heading", { level: 1, name: "5000m 최고기록은?" })).toHaveFocus()
    expect(container.querySelector(".contextual-illustration")).not.toBeInTheDocument()
    await user.type(screen.getByRole("textbox", { name: "최고기록" }), "20:30")
    await user.click(screen.getByRole("button", { name: "이전 단계로" }))
    await user.click(screen.getByRole("button", { name: "5000m" }))
    expect(screen.getByRole("textbox", { name: "최고기록" })).toHaveValue("20:30")
  })
  it("produces a personal reading without a journal or storage writes", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem")
    await ownReading()
    expect(screen.getByRole("heading", { name: "내 5000m 기록 요약" })).toBeVisible()
    expect(screen.getByText("4분 6초", { exact: true })).toBeVisible()
    expect(screen.getByText("1분 38.4초", { exact: true })).toBeVisible()
    expect(local).not.toHaveBeenCalled()
  })
  it("offers concrete chapter names, visible limits and a focused 400m result without extra entry steps", async () => {
    const user = await ownReading()
    const chapterChoices = screen.getByRole("group", { name: "풀이 내용" })
    expect(within(chapterChoices).getByRole("button", { name: "기록 요약", pressed: true })).toBeVisible()
    expect(screen.getByText("최고기록을 나눈 값이며, 오늘의 훈련 목표는 아니에요.")).toBeVisible()
    const numbers = screen.getByText("평균 1km").closest("dl")!
    const explanation = numbers.parentElement!.querySelector(".record-reading__story")!
    expect(numbers.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(within(chapterChoices).getByRole("button", { name: "400m 평균" }))
    expect(screen.getByRole("heading", { level: 1, name: "400m 평균 시간" })).toHaveFocus()
    expect(screen.getByText("1분 38.4초", { exact: true })).toBeVisible()
    expect(screen.getByText(/실제 랩마다 이 속도였다는 뜻은 아니에요/u)).toBeVisible()
  })
  it("asks for friend consent, preserves input on Back, and explains a real difference", async () => {
    const user = await ownReading()
    await user.click(screen.getByRole("button", { name: "친구와 러닝 궁합 보기" }))
    await user.click(screen.getByRole("button", { name: "5000m" }))
    await user.type(screen.getByRole("textbox", { name: "최고기록" }), "21:40")
    const compare = screen.getByRole("button", { name: "친구 기록과 비교하기" })
    expect(compare).toBeDisabled()
    expect(screen.getByText("동의를 확인하면 풀이를 볼 수 있어요.")).toBeVisible()
    fireEvent.submit(compare.closest("form")!)
    expect(screen.getByRole("alert")).toHaveTextContent("동의")
    await user.click(screen.getByRole("checkbox"))
    expect(compare).toBeEnabled()
    await user.click(compare)
    expect(screen.getByRole("heading", { name: "나와 친구의 기록 비교" })).toBeVisible()
    expect(screen.getByText(/차이는 1분 10초예요/u)).toBeVisible()
    await user.click(within(screen.getByRole("group", { name: "풀이 내용" })).getByRole("button", { name: "함께 달리기" }))
    expect(screen.getByRole("heading", { name: "본운동은 각자의 리듬" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 단계로" }))
    expect(screen.getByRole("textbox", { name: "최고기록" })).toHaveValue("21:40")
  })
  it("does not generate a result from an ambiguous time", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: "800m" }))
    await user.type(screen.getByRole("textbox", { name: "최고기록" }), "202")
    await user.click(screen.getByRole("button", { name: "나의 러닝 풀이 보기" }))
    expect(screen.getByRole("alert")).toHaveTextContent("분:초")
    expect(screen.queryByRole("group", { name: "풀이 내용" })).not.toBeInTheDocument()
  })
  it("reads a friend alone and keeps person labels correct when adding my record", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: "친구 기록" }))
    await user.click(screen.getByRole("button", { name: "5000m" }))
    await user.type(screen.getByRole("textbox", { name: "최고기록" }), "21:40")
    const readFriend = screen.getByRole("button", { name: "친구의 러닝 풀이 보기" })
    expect(readFriend).toBeDisabled()
    fireEvent.submit(readFriend.closest("form")!)
    expect(screen.getByRole("alert")).toHaveTextContent("동의")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "친구의 러닝 풀이 보기" }))
    expect(screen.getByRole("heading", { name: "친구의 5000m 기록 요약" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "내 기록과 러닝 궁합 보기" }))
    await user.click(screen.getByRole("button", { name: "5000m" }))
    await user.type(screen.getByRole("textbox", { name: "최고기록" }), "20:30")
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "친구 기록과 비교하기" }))
    const self = screen.getByText("나 · 5000m").parentElement!
    const other = screen.getByText("친구 · 5000m").parentElement!
    expect(within(self).getByText("20분 30초")).toBeVisible()
    expect(within(other).getByText("21분 40초")).toBeVisible()
  })
})
