import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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
  it("produces a personal reading without a journal or storage writes", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem")
    await ownReading()
    expect(screen.getByRole("heading", { name: "5000m에 담긴 나의 리듬" })).toBeVisible()
    expect(screen.getByText("4분 6초", { exact: true })).toBeVisible()
    expect(screen.getByText("1분 38.4초", { exact: true })).toBeVisible()
    expect(local).not.toHaveBeenCalled()
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
    expect(screen.getByRole("heading", { name: "같은 거리, 서로 다른 리듬" })).toBeVisible()
    expect(screen.getByText(/차이는 1분 10초예요/u)).toBeVisible()
    await user.click(within(screen.getByRole("group", { name: "풀이 내용" })).getByRole("button", { name: "러닝 궁합" }))
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
    expect(screen.getByRole("heading", { name: "5000m에 담긴 친구의 리듬" })).toBeVisible()
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
