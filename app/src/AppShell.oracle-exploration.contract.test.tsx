import React from "react"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOracleTopic, ORACLE_TOPICS, type OracleTopicId } from "./domain/oracle-exploration"

vi.mock("./screens/Home", () => ({
  Home: ({ onOpenOracle }: { onOpenOracle: (topic: OracleTopicId) => void }) => (
    <section>
      <h1>홈 출발 화면</h1>
      <input aria-label="홈 화면 선택" defaultValue="" />
      <button type="button" onClick={() => onOpenOracle("level")}>홈 현재 수준 예시</button>
    </section>
  ),
}))

vi.mock("./screens/LogEntry", () => ({
  LogEntry: () => <h1>새 일지 작성</h1>,
}))

vi.mock("./DeferredMobileScreens", async () => {
  const { OracleExplore } = await import("./screens/OracleExplore")
  return {
    DeferredMobileScreens: {
      OracleExplore,
      Trends: ({ onOpenOracle }: { onOpenOracle: (topic: OracleTopicId) => void }) => (
        <section>
          <h1>분석 출발 화면</h1>
          <input aria-label="분석 화면 선택" defaultValue="" />
          <button type="button" onClick={() => onOpenOracle("compare")}>분석 훈련 비교 예시</button>
        </section>
      ),
      AthleteRecords: () => <h1>내 종목 기록</h1>,
      JournalArchive: () => <h1>지난 일지</h1>,
      PlanBeta: () => <h1>내 훈련 계획</h1>,
      PlanProposalInbox: () => null,
    },
  }
})

import { AppShell } from "./AppShell"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/?app=1")
})

afterEach(cleanup)

function mainTabs() {
  return within(screen.getByRole("navigation", { name: "주 탭" }))
}

function storageSnapshot(storage: Storage) {
  return Object.fromEntries(Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index)!
    return [key, storage.getItem(key)]
  }))
}

describe("AppShell oracle exploration navigation", () => {
  it.each([
    { origin: "홈", heading: "홈 출발 화면", openLabel: "홈 현재 수준 예시", topic: "level", next: "focus" },
    { origin: "분석", heading: "분석 출발 화면", openLabel: "분석 훈련 비교 예시", topic: "compare", next: "change" },
  ] as const)("opens from $origin and browser Back restores the previous topic then the untouched origin", async ({ origin, heading, openLabel, topic, next }) => {
    const user = userEvent.setup()
    render(<AppShell />)
    if (origin === "분석") await user.click(mainTabs().getByRole("button", { name: "분석" }))
    await user.type(screen.getByRole("textbox", { name: `${origin} 화면 선택` }), "선택 유지")

    await user.click(screen.getByRole("button", { name: openLabel }))

    expect(screen.getByRole("heading", { name: getOracleTopic(topic).example.headline })).toBeVisible()
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument()
    expect(window.location.search).toBe("?app=1")
    expect(mainTabs().getAllByRole("button").map(button => button.textContent)).toEqual([
      "홈", "일지", "기록하기", "계획", "분석",
    ])
    expect(mainTabs().getByRole("button", { name: origin })).toHaveAttribute("aria-current", "page")

    await user.selectOptions(screen.getByRole("combobox", { name: "분석 주제" }), next)
    expect(screen.getByRole("heading", { name: getOracleTopic(next).example.headline })).toBeVisible()

    act(() => window.history.back())
    await waitFor(() => expect(screen.getByRole("combobox", { name: "분석 주제" })).toHaveValue(topic))
    expect(screen.getByRole("heading", { name: getOracleTopic(topic).example.headline })).toBeVisible()

    act(() => window.history.back())
    await waitFor(() => expect(screen.getByRole("heading", { name: heading })).toBeVisible())
    expect(screen.getByRole("textbox", { name: `${origin} 화면 선택` })).toHaveValue("선택 유지")
    expect(screen.queryByRole("combobox", { name: "분석 주제" })).not.toBeInTheDocument()
    expect(mainTabs().getByRole("button", { name: origin })).toHaveAttribute("aria-current", "page")
  })

  it.each([
    { topicId: "level", action: "records", heading: "내 종목 기록", tab: "계획" },
    { topicId: "focus", action: "journal", heading: "지난 일지", tab: "일지" },
    { topicId: "priority", action: "plan", heading: "내 훈련 계획", tab: "계획" },
    { topicId: "mix", action: "trends", heading: "분석 출발 화면", tab: "분석" },
  ] as const)("routes the $action personal action to its actual destination", async ({ topicId, action, heading, tab }) => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "홈 현재 수준 예시" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "분석 주제" }), topicId)
    const topic = getOracleTopic(topicId)
    expect(topic.personalAction).toBe(action)

    await user.click(screen.getByRole("button", { name: topic.personalLabel }))

    expect(screen.getByRole("heading", { name: heading })).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "분석 주제" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "새 일지 작성" })).not.toBeInTheDocument()
    expect(mainTabs().getByRole("button", { name: tab })).toHaveAttribute("aria-current", "page")
  })

  it("keeps bottom tabs usable and dismisses the example when switching tabs", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "홈 현재 수준 예시" }))

    await user.click(mainTabs().getByRole("button", { name: "분석" }))

    expect(screen.getByRole("heading", { name: "분석 출발 화면" })).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "분석 주제" })).not.toBeInTheDocument()
    expect(mainTabs().getByRole("button", { name: "분석" })).toHaveAttribute("aria-current", "page")
  })

  it("does not reopen an abandoned topic over another tab after browser Back", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "홈 현재 수준 예시" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "분석 주제" }), "focus")
    await user.click(mainTabs().getByRole("button", { name: "분석" }))
    expect(screen.getByRole("heading", { name: "분석 출발 화면" })).toBeVisible()

    const popped = new Promise<void>(resolve => {
      window.addEventListener("popstate", () => resolve(), { once: true })
    })
    await act(async () => {
      window.history.back()
      await popped
    })

    expect(screen.getByRole("heading", { name: "분석 출발 화면" })).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "분석 주제" })).not.toBeInTheDocument()
  })

  it("browses every sample and follows its next topic without writing personal storage", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem("oracle-contract-existing-data", "keep-local")
    window.sessionStorage.setItem("oracle-contract-existing-data", "keep-session")
    render(<AppShell />)
    const localBefore = storageSnapshot(window.localStorage)
    const sessionBefore = storageSnapshot(window.sessionStorage)
    const write = vi.spyOn(Storage.prototype, "setItem")
    const remove = vi.spyOn(Storage.prototype, "removeItem")
    const clear = vi.spyOn(Storage.prototype, "clear")

    await user.click(screen.getByRole("button", { name: "홈 현재 수준 예시" }))
    for (const topic of ORACLE_TOPICS) {
      await user.selectOptions(screen.getByRole("combobox", { name: "분석 주제" }), topic.id)
      expect(screen.getByRole("heading", { name: topic.example.headline })).toBeVisible()
      expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    }
    const lastTopic = ORACLE_TOPICS[ORACLE_TOPICS.length - 1]!
    await user.click(screen.getByRole("button", { name: new RegExp(lastTopic.nextLabel) }))
    expect(screen.getByRole("combobox", { name: "분석 주제" })).toHaveValue(lastTopic.nextId)
    await user.click(mainTabs().getByRole("button", { name: "홈" }))

    expect(screen.getByRole("heading", { name: "홈 출발 화면" })).toBeVisible()
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(storageSnapshot(window.localStorage)).toEqual(localBefore)
    expect(storageSnapshot(window.sessionStorage)).toEqual(sessionBefore)
  })
})
