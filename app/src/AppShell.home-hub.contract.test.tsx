import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlannedSessionLink } from "./domain/planned-session-link"

const LINK = {
  schemaVersion: 1,
  plannedSessionId: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  planVersionId: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  candidateFingerprint: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  sessionContentFingerprint: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
  plannedDate: "2026-09-20",
  sessionDay: 1,
  sessionSlot: "AM",
  plannedRole: "EASY",
  plannedEnergyIntent: "BASE_INTENT",
  linkSource: "ATHLETE_SELECTED_FROM_PLAN",
  linkedAt: "2026-09-20T00:00:00.000Z",
} as PlannedSessionLink

vi.mock("./components/AppShellFrame", () => ({
  AppShellFrame: ({ children }: { children: React.ReactNode }) => (
    <div>
      {children}
    </div>
  ),
}))

vi.mock("./screens/Home", () => ({
  Home: (props: {
    onOpenContent: () => void
    onOpenMore: () => void
    onOpenRewards: () => void
    onOpenNextTraining: (link: PlannedSessionLink) => void
  }) => (
    <main>
      <h1>홈</h1>
      <button type="button" onClick={props.onOpenContent}>홈 콘텐츠 열기</button>
      <button type="button" onClick={props.onOpenMore}>홈 더보기 열기</button>
      <button type="button" onClick={props.onOpenRewards}>홈 보상 열기</button>
      <button type="button" onClick={() => props.onOpenNextTraining(LINK)}>다음 훈련 열기</button>
    </main>
  ),
}))

vi.mock("./DeferredMobileScreens", () => ({
  DeferredMobileScreens: {
    More: ({ onBack, onOpenContent, onOpenRewards }: { onBack: () => void; onOpenContent: () => void; onOpenRewards: () => void }) => (
      <main><h1>더보기 화면</h1><button onClick={onOpenContent}>더보기 콘텐츠 열기</button><button onClick={onOpenRewards}>더보기 보상 열기</button><button onClick={onBack}>더보기 뒤로</button></main>
    ),
    TrainingContent: ({ onBack }: { onBack: () => void }) => <main><h1>훈련 콘텐츠</h1><button onClick={onBack}>콘텐츠 뒤로</button></main>,
    JournalRewards: ({ onBack, onDecorateToday }: { onBack: () => void; onDecorateToday: () => void }) => <main><h1>일지 꾸미기·포인트</h1><button onClick={onBack}>보상 뒤로</button><button onClick={onDecorateToday}>오늘 꾸미기</button></main>,
    JournalDayReader: ({ onBack }: { onBack: () => void }) => <main><h1>오늘 일지</h1><button onClick={onBack}>일지 뒤로</button></main>,
    PlanBeta: ({ returnToSession }: { returnToSession?: PlannedSessionLink }) => <main><h1>계획</h1><output data-testid="return-session">{returnToSession?.plannedSessionId ?? "none"}</output></main>,
    PlanProposalInbox: () => null,
  },
}))

import { AppShell } from "./AppShell"

afterEach(cleanup)

describe("AppShell home hub secondary destinations", () => {
  it.each([
    ["home", "홈 콘텐츠 열기", "홈"],
    ["more", "더보기 콘텐츠 열기", "더보기 화면"],
  ] as const)("returns content to its originating surface: %s", async (source, openLabel, expected) => {
    const user = userEvent.setup()
    render(<AppShell />)
    if (source === "more") await user.click(screen.getByRole("button", { name: "홈 더보기 열기" }))
    await user.click(screen.getByRole("button", { name: openLabel }))
    expect(screen.getByRole("heading", { name: "훈련 콘텐츠" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "콘텐츠 뒤로" }))
    expect(screen.getByRole("heading", { name: expected })).toBeVisible()
  })

  it.each([
    ["홈 보상 열기", "홈"],
    ["더보기 보상 열기", "더보기 화면"],
  ] as const)("returns rewards to its originating surface: %s", async (openLabel, expected) => {
    const user = userEvent.setup()
    render(<AppShell />)
    if (openLabel === "더보기 보상 열기") {
      await user.click(screen.getByRole("button", { name: "홈 더보기 열기" }))
    }
    await user.click(screen.getByRole("button", { name: openLabel }))
    expect(screen.getByRole("heading", { name: "일지 꾸미기·포인트" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "보상 뒤로" }))
    expect(screen.getByRole("heading", { name: expected })).toBeVisible()
  })

  it("opens today's journal detail when rewards asks to decorate today", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "홈 보상 열기" }))
    await user.click(screen.getByRole("button", { name: "오늘 꾸미기" }))
    expect(screen.getByRole("heading", { name: "오늘 일지" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일지 뒤로" }))
    expect(screen.getByRole("heading", { name: "일지 꾸미기·포인트" })).toBeVisible()
  })

  it("forwards the immutable next-training link to PlanBeta", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "다음 훈련 열기" }))
    expect(screen.getByTestId("return-session")).toHaveTextContent(LINK.plannedSessionId)
  })
})
