import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FIELD_PROVENANCE } from "../domain/field-provenance"
import { MEMO_PURPOSE } from "../domain/journal-schema"
import { saveEntry, todayISO } from "../domain/journal-store"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

async function answerMinimumPlanQuestions(
  riskAnswer: "clear" | "review" = "clear",
): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /훈련 경험 있음/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획.*권장/u }))
  await user.click(screen.getByRole("button", {
    name: riskAnswer === "clear"
      ? /통증은 없고 몸 상태는 평소와 같아요/u
      : /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u,
  }))
}

function savePostSession(
  id: string,
  memo = "",
  memoPurpose?: (typeof MEMO_PURPOSE)[keyof typeof MEMO_PURPOSE],
  date = todayISO(),
): void {
  expect(saveEntry({
    id,
    kind: "post-session",
    date,
    savedAt: `${date}T08:00:00.000Z`,
    syncState: "local",
    system: "",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo,
    memoPurpose,
  }).ok).toBe(true)
}

describe("plan beta user flow", () => {
  it("creates two profile-only candidates without journal data", async () => {
    render(<PlanBeta />)

    await answerMinimumPlanQuestions()

    expect(screen.getByRole("heading", { name: "두 후보를 비교해보세요" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "균형형" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "보수형" })).toBeVisible()
    expect(screen.getByText(/프로필 기반.*제한 신뢰도/u)).toBeVisible()
    expect(screen.queryByText(/정확한 페이스/u)).toBeVisible()
  })

  it("blocks generation when current risk is present or unclear", async () => {
    const onWriteLog = vi.fn()
    render(<PlanBeta onWriteLog={onWriteLog} />)

    await answerMinimumPlanQuestions("review")

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "균형형" })).toBeNull()
    await userEvent.setup().click(
      screen.getByRole("button", { name: "통증·컨디션 기록하기" }),
    )
    expect(onWriteLog).toHaveBeenCalledWith("evening")
  })

  it("does not let a favorable answer override recent structured high pain", async () => {
    const date = todayISO()
    expect(saveEntry({
      id: "recent-high-pain",
      kind: "evening",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { knee: 5 },
      mood: 0,
      note: "",
      fieldProvenance: {
        painParts: { provenance: FIELD_PROVENANCE.explicit },
      },
    }).ok).toBe(true)
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "균형형" })).toBeNull()
  })

  it("blocks on a recent analyzable memo without retaining its raw text", async () => {
    savePostSession(
      "recent-analyzable-risk",
      "무릎이 계속 아파요",
      MEMO_PURPOSE.analyzableTrainingNote,
    )
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("does not inspect a private memo while checking recent journal risk", async () => {
    savePostSession(
      "recent-private-note",
      "무릎이 계속 아파요",
      MEMO_PURPOSE.privateSelfOnly,
    )
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByRole("heading", { name: "두 후보를 비교해보세요" })).toBeVisible()
  })

  it("labels journal presence honestly when its values do not alter prescriptions", async () => {
    savePostSession("recent-session-1")
    savePostSession("recent-session-2")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByText("일지 보유 · 처방 미반영")).toBeVisible()
    expect(screen.getByText(/일지 수치나 메모를 반영하지 않습니다/u)).toBeVisible()
  })

  it("does not label future or calendar-invalid entries as recent journal context", async () => {
    savePostSession("future-session-1", "", undefined, "2099-01-01")
    savePostSession("future-session-2", "", undefined, "2099-01-02")
    savePostSession("invalid-session", "", undefined, "2026-02-31")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByText("프로필 기반 · 제한 신뢰도")).toBeVisible()
    expect(screen.queryByText("일지 보유 · 처방 미반영")).toBeNull()
  })

  it("selects a candidate, stores it locally, and records progress without points", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()

    await user.click(screen.getByRole("button", { name: "균형형 선택하기" }))

    expect(screen.getByRole("heading", { name: "균형형 9일 계획" })).toBeVisible()
    const dayOneActions = screen.getByLabelText("DAY 1 진행 기록")
    await user.click(within(dayOneActions).getByRole("button", { name: "완료" }))

    const stored = window.localStorage.getItem("trainoracle.plan-beta.v1")
    expect(stored).toContain("\"state\":\"COMPLETED\"")
    expect(stored).not.toMatch(/point|reward|memo|symptom/u)
  })

  it("carries structured progress into the next frame without automatic progression", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    await user.click(screen.getByRole("button", { name: "보수형 선택하기" }))
    await user.click(
      within(screen.getByLabelText("DAY 1 진행 기록"))
        .getByRole("button", { name: "휴식" }),
    )
    await user.click(screen.getByRole("button", { name: "다음 주기 후보 만들기" }))
    await user.click(screen.getByRole("button", {
      name: /통증은 없고 몸 상태는 평소와 같아요/u,
    }))

    expect(screen.getByText(/지난 계획의 선택·진행 집계를 이어받음/u)).toBeVisible()
    expect(screen.getByText(/자동 강도 상승 없음/u)).toBeVisible()
  })
})
