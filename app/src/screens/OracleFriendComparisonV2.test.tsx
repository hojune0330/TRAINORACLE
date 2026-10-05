import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { OracleFriendComparisonV2 } from "./OracleFriendComparisonV2"
import { createSelfReportedAthleteRecord } from "../domain/athlete-records"

afterEach(cleanup)
const today = "2026-10-04"
const records = [createSelfReportedAthleteRecord({ id: "own-race", purpose: "RECENT_RESULT", eventDistanceM: 5000, performanceSeconds: 1200, achievedOn: "2026-10-01", seasonId: null }, new Date(`${today}T12:00:00`))!]
async function prepare() {
  const user = userEvent.setup()
  const back = vi.fn()
  const view = render(<OracleFriendComparisonV2 today={today} ownProfile={null} records={records} onBack={back} />)
  await user.click(screen.getByRole("checkbox", { name: /명시적으로 허락/ }))
  await user.click(within(screen.getByRole("group", { name: "친구가 비교를 허락한 항목" })).getByRole("checkbox", { name: "실제 경기 기록" }))
  await user.selectOptions(screen.getByLabelText("친구 경기 종목"), "5000")
  await user.type(screen.getByLabelText("친구 경기 기록 · 분:초"), "21:40")
  fireEvent.change(screen.getByLabelText("친구 기록 달성일"), { target: { value: "2026-10-01" } })
  await user.click(screen.getByRole("button", { name: "기록 반영" }))
  return { user, back, view }
}
async function permitExport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole("group", { name: "외부 공유를 별도로 허락한 항목" })).getByRole("checkbox", { name: "실제 경기 기록" }))
  await user.click(screen.getByRole("checkbox", { name: /외부 공유를 별도로 허락했어요/ }))
  await user.click(screen.getByRole("button", { name: "공유 미리보기" }))
}

it("gates manual entry and never writes storage or sends a network request", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem")
  const fetch = vi.spyOn(globalThis, "fetch")
  const { user } = await prepare()
  expect(screen.getByRole("button", { name: "공유 미리보기" })).toBeDisabled()
  expect(screen.getByRole("article", { name: "현재 비교 결과" })).toHaveTextContent("100 초")
  await permitExport(user)
  expect(screen.getByRole("region", { name: "허용된 사실 미리보기" })).toHaveTextContent("100 초")
  expect(storage).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("revocation clears the peer draft, visible results and export before regrant", async () => {
  const { user } = await prepare(); await permitExport(user)
  await user.click(screen.getByRole("button", { name: "동의 철회" }))
  expect(screen.queryByRole("article", { name: "현재 비교 결과" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "허용된 사실 미리보기" })).not.toBeInTheDocument()
  expect(screen.queryByLabelText("친구 경기 기록 · 분:초")).not.toBeInTheDocument()
  await user.click(screen.getByRole("checkbox", { name: /명시적으로 허락/ }))
  await user.click(within(screen.getByRole("group", { name: "친구가 비교를 허락한 항목" })).getByRole("checkbox", { name: "실제 경기 기록" }))
  expect(screen.getByLabelText("친구 경기 기록 · 분:초")).toHaveValue("")
  expect(screen.getByRole("article", { name: "현재 비교 결과" })).not.toHaveTextContent("100 초")
  expect(screen.getByRole("button", { name: "공유 미리보기" })).toBeDisabled()
})

it("removing a field or editing a draft invalidates previously permitted preview", async () => {
  const { user } = await prepare(); await permitExport(user)
  await user.type(screen.getByLabelText("친구 경기 기록 · 분:초"), "0")
  expect(screen.queryByRole("region", { name: "허용된 사실 미리보기" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "공유 미리보기" })).toBeDisabled()
  await user.click(within(screen.getByRole("group", { name: "친구가 비교를 허락한 항목" })).getByRole("checkbox", { name: "실제 경기 기록" }))
  expect(screen.queryByLabelText("친구 경기 기록 · 분:초")).not.toBeInTheDocument()
  expect(screen.getByRole("article", { name: "현재 비교 결과" })).not.toHaveTextContent("100 초")
})

it("back clears permission even when the embedding parent does not immediately unmount", async () => {
  const { user, back } = await prepare(); await permitExport(user)
  await user.click(screen.getByRole("button", { name: "뒤로" }))
  expect(back).toHaveBeenCalledOnce()
  expect(screen.queryByRole("region", { name: "허용된 사실 미리보기" })).not.toBeInTheDocument()
  expect(screen.getByRole("checkbox", { name: /명시적으로 허락/ })).not.toBeChecked()
})

it("a new parent record collection invalidates external permission", async () => {
  const { user, view, back } = await prepare(); await permitExport(user)
  view.rerender(<OracleFriendComparisonV2 today={today} ownProfile={null} records={null} onBack={back} />)
  expect(screen.queryByRole("region", { name: "허용된 사실 미리보기" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "공유 미리보기" })).toBeDisabled()
  expect(screen.getByText("내 경기 기록을 확인하지 못했어요.")).toBeVisible()
})
