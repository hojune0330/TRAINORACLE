import React from "react"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import type { OracleTopicId } from "./domain/oracle-exploration"
import type { LogEntryProps } from "./screens/LogEntry"

vi.mock("./screens/LogEntry", () => ({ LogEntry: ({ onBack, onDone }: LogEntryProps) => <>
  <h1>계획에서 연 일지</h1><button onClick={onBack}>일지 취소</button>
  <button onClick={() => onDone?.("post-session", { id: "oracle-plan-synthetic", kind: "post-session",
    date: "2026-10-07", savedAt: "2026-10-07T00:00:00.000Z", syncState: "synced", system: "run",
    title: "Synthetic navigation", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" })}>일지 저장 완료</button>
</> }))

vi.mock("./screens/Home", () => ({
  Home: ({ onOpenOracle, onOpenPlan }: {
    onOpenOracle: (topic: OracleTopicId, mode: "personal") => void
    onOpenPlan: () => void
  }) => <><h1>출발 화면</h1>
    <button onClick={() => onOpenOracle("focus", "personal")}>계획 해설 열기</button>
    <button onClick={onOpenPlan}>홈에서 계획 만들기</button>
  </>,
}))
vi.mock("./DeferredMobileScreens", async () => {
  const { usePlanDraftNavigationGuard } = await import("./screens/plan-beta/usePlanDraftNavigationGuard")
  const { PlanDayReader } = await import("./screens/plan-beta/PlanDayReader")
  function Plan({ onWriteLog }: { onWriteLog: (entryType: "quick-session") => void }) {
    const [value, setValue] = React.useState("")
    const [reader, setReader] = React.useState(false)
    usePlanDraftNavigationGuard(value !== "")
    return <><h1>계획 입력</h1>
      <input aria-label="입력한 계획" value={value} onChange={event => setValue(event.target.value)} />
      <button onClick={() => setReader(true)}>계획 날짜 열기</button>
      <button onClick={() => onWriteLog("quick-session")}>계획에서 일지 쓰기</button>
      {reader && <PlanDayReader date="2026-10-07" sessions={[]} canPrevious={false} canNext={false}
        onPrevious={() => {}} onNext={() => {}} onClose={() => setReader(false)}><p>선택한 날짜</p></PlanDayReader>}
    </>
  }
  return { DeferredMobileScreens: {
    PlanBeta: Plan,
    PlanProposalInbox: () => null,
    OracleExplore: ({ topicId, initialMode, onPersonalAction, onBack }: {
      topicId: OracleTopicId; initialMode?: "example" | "personal"
      onPersonalAction: (action: "plan") => void; onBack: () => void
    }) => <><h1>원래 오라클 해설</h1><output aria-label="해설 위치">{topicId}:{initialMode}</output>
      <button onClick={() => onPersonalAction("plan")}>해설에서 계획 만들기</button>
      <button onClick={onBack}>해설 닫기</button>
    </>,
  } }
})

import { AppShell } from "./AppShell"

beforeEach(() => {
  setActiveLocalAccount(null); localStorage.clear(); sessionStorage.clear()
  window.history.replaceState({ unrelated: "keep" }, "", "/?app=1")
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function back() {
  const popped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }))
  await act(async () => { window.history.back(); await popped })
}
async function fromOracle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "계획 해설 열기" }))
  await user.click(screen.getByRole("button", { name: "해설에서 계획 만들기" }))
  expect(screen.getByRole("heading", { name: "계획 입력" })).toBeVisible()
}

it("returns from an Oracle-started plan in one Back with its original topic and mode", async () => {
  const user = userEvent.setup(); render(<AppShell />)
  await fromOracle(user)
  await back()
  expect(screen.getByRole("heading", { name: "원래 오라클 해설" })).toBeVisible()
  expect(screen.getByLabelText("해설 위치")).toHaveTextContent("focus:personal")
  expect(window.history.state.unrelated).toBe("keep")
  // Re-entering from the restored result must retain the same single-Back contract.
  await user.click(screen.getByRole("button", { name: "해설에서 계획 만들기" }))
  await back()
  expect(screen.getByRole("heading", { name: "원래 오라클 해설" })).toBeVisible()
})

it("keeps the plan input after cancelling Back and returns to Oracle after confirming", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
  const user = userEvent.setup(); render(<AppShell />)
  await fromOracle(user)
  await user.type(screen.getByLabelText("입력한 계획"), "작성 유지")
  await back()
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText("입력한 계획")).toHaveValue("작성 유지")
  await back()
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(screen.getByRole("heading", { name: "원래 오라클 해설" })).toBeVisible()
})

it("closes a nested plan reader without discarding or leaving the Oracle-started plan", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const user = userEvent.setup(); render(<AppShell />)
  await fromOracle(user)
  await user.type(screen.getByLabelText("입력한 계획"), "작성 유지")
  await user.click(screen.getByRole("button", { name: "계획 날짜 열기" }))
  expect(screen.getByRole("dialog")).toBeVisible()
  await back()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.getByLabelText("입력한 계획")).toHaveValue("작성 유지")
  expect(confirm).not.toHaveBeenCalled()
  await back()
  expect(confirm).toHaveBeenCalledTimes(1)
})

it("does not revive an Oracle origin abandoned through the main tabs", async () => {
  const user = userEvent.setup(); render(<AppShell />)
  await fromOracle(user)
  await user.click(within(screen.getByRole("navigation", { name: "주 탭" })).getByRole("button", { name: "홈" }))
  await back()
  expect(screen.getByRole("heading", { name: "출발 화면" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "원래 오라클 해설" })).toBeNull()
})

it("keeps a plan entered directly from home separate from Oracle return history", async () => {
  const user = userEvent.setup(); render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "홈에서 계획 만들기" }))
  await user.click(screen.getByRole("button", { name: "계획 날짜 열기" }))
  await user.click(screen.getByRole("button", { name: "달력으로 돌아가기" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(screen.getByRole("heading", { name: "계획 입력" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "원래 오라클 해설" })).toBeNull()
})

it.each(["일지 취소", "일지 저장 완료"])("returns %s to its parent plan before returning to Oracle", async action => {
  const user = userEvent.setup(); render(<AppShell />)
  await fromOracle(user)
  await user.click(screen.getByRole("button", { name: "계획에서 일지 쓰기" }))
  expect(screen.getByRole("heading", { name: "계획에서 연 일지" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: action }))
  await waitFor(() => expect(screen.getByRole("heading", { name: "계획 입력" })).toBeVisible())
  expect(screen.queryByRole("heading", { name: "원래 오라클 해설" })).toBeNull()
  await back()
  expect(screen.getByRole("heading", { name: "원래 오라클 해설" })).toBeVisible()
})
