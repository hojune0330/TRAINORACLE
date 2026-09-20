/* LEGACY_11STEP_FLOW: 2026-09 4질문 빠른 흐름 도입으로 옛 인테이크 클릭 순서를 전제한 테스트. 다듬기 경로로 재작성 예정(PR #341 본문). */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FIELD_PROVENANCE } from "../domain/field-provenance"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-local-storage"
import { MEMO_PURPOSE } from "../domain/journal-schema"
import { saveEntry, savePrivateEntry, todayISO } from "../domain/journal-store"
import { loadPlanBetaState, loadPreviousIntake, savePlanBetaState } from "../domain/plan-beta-store"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { createRecoveryCode } from "../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../domain/account/private-note-sync"
import { PlanBeta } from "./PlanBeta"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/**
 * 빠른 흐름: 목표 → 경험 → 운동할 날 → 몸 상태. 네 번째 답과 함께 계획이 만들어진다.
 * 나머지(부문·훈련 종류·안내 방식·달력 길이·시간대·하루 두 번·대회 날짜)는 기본값이며 결과 화면 "다듬기"에서 바꾼다.
 */
async function answerQuickPlanQuestions(
  riskAnswer: "clear" | "review" = "clear",
  options: {
    readonly event?: RegExp
    readonly experience?: RegExp
    readonly days?: RegExp
  } = {},
): Promise<void> {
  const user = userEvent.setup()
  await enterPlanWithoutRecord(options.event)
  await user.click(screen.getByRole("button", { name: options.experience ?? /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", { name: options.days ?? /^3일/u }))
  await user.click(screen.getByRole("button", {
    name: riskAnswer === "clear"
      ? /통증은 없고 몸 상태는 평소와 같아요/u
      : /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u,
  }))
}

async function answerMinimumPlanQuestions(
  riskAnswer: "clear" | "review" = "clear",
): Promise<void> {
  await answerQuickPlanQuestions(riskAnswer)
}

/** 결과 화면의 다듬기 패널을 열고 항목 하나를 탭한다. */
async function openRefinement(label: string): Promise<void> {
  const user = userEvent.setup()
  const summary = screen.getByText("계획 다듬기")
  await user.click(summary)
  await user.click(screen.getByRole("button", { name: new RegExp(`^${label} 바꾸기`, "u") }))
}

function expectGeneratedCandidates(): void {
  expect(screen.getByRole("heading", {
    name: "계획이 준비됐어요",
  })).toBeVisible()
  expect(screen.getAllByRole("button", { name: "이 일정으로 시작" })).toHaveLength(1)
  expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
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
  it("generates a plan after exactly four answers and shows the refine panel with defaults", async () => {
    render(<PlanBeta />)

    await answerQuickPlanQuestions("clear")

    expectGeneratedCandidates()
    expect(screen.getByText("계획 다듬기")).toBeVisible()
    expect(screen.getByText("지금은 기본 설정이에요")).toBeVisible()
    // 기본값이 결과 화면 요약에 그대로 드러난다(숨기지 않음).
    expect(screen.getByRole("button", { name: /^달력 길이 바꾸기 · 지금 9일/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^훈련 종류 바꾸기 · 지금 골고루/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^시간대 바꾸기 · 지금 날마다 달라요/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^하루 두 번 바꾸기 · 지금 안 함/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^참가 부문 바꾸기 · 지금 선택하지 않음/u })).toBeInTheDocument()
  })

  it("does not ask division, focus, template, frame length, time or two-a-day before the plan exists", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await enterPlanWithoutRecord()
    expect(screen.queryByRole("heading", { name: /부문/u })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    expect(screen.getByRole("heading", { name: "이번 9일 중 며칠 훈련할까요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    expect(screen.getByRole("heading", { name: "지금 몸은 어때요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /RPE 기준으로 받기/u })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /9일 계획 받기/u })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /하루 한 번 운동/u })).not.toBeInTheDocument()
  })

  it("shows a growing calendar peek while answering and never a training prescription before safety", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    expect(screen.getByRole("combobox", { name: "종목" })).toBeVisible()
    await enterPlanWithoutRecord(/^10km/u)
    expect(screen.getByRole("figure", { name: /10km 달력 준비 중/u })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /달리기를 막 시작했어요/u }))
    expect(screen.getByRole("figure", { name: /10km · 처음/u })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^4일/u }))
    expect(screen.getByRole("figure", { name: /10km · 처음 · 9일 중 4일/u })).toBeVisible()
    expect(screen.queryByText(/RPE \d/u)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("keeps the chosen answers on the blocked screen and resumes at the safety question", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await answerQuickPlanQuestions("review", { event: /^10km/u, experience: /달리기를 막 시작했어요/u, days: /^3일/u })

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.getByText("10km · 처음 · 9일 중 3일")).toBeVisible()
    expect(screen.queryByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()

    await user.click(screen.getByRole("button", { name: "다시 확인하기" }))
    expect(screen.getByRole("heading", { name: "지금 몸은 어때요?" })).toBeVisible()
    // 이전 답은 남아 있으므로 안전 확인 한 번으로 계획이 나온다.
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expectGeneratedCandidates()
  })

  it("refines one item after the plan exists and regenerates without re-asking the four questions", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerQuickPlanQuestions("clear")
    expectGeneratedCandidates()

    await openRefinement("달력 길이")
    expect(screen.getByRole("heading", { name: "며칠짜리 달력을 받을까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "계획으로" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /7일만 먼저 받기/u }))

    expectGeneratedCandidates()
    expect(screen.getByText("1개 바꿨어요")).toBeVisible()
    expect(screen.getByRole("button", { name: /^달력 길이 바꾸기 · 지금 7일/u })).toBeInTheDocument()
    expect(screen.getAllByText(/1500m.*7일/u)).not.toHaveLength(0)
  })

  it("keeps an optional target race date in preview memory only when refined after the plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerQuickPlanQuestions("clear")

    await openRefinement("대회 날짜")
    expect(screen.getByRole("heading", { name: "대회 날짜가 있나요?" })).toBeVisible()
    const raceDate = screen.getByLabelText("목표 경기 날짜")
    await user.type(raceDate, "2099-08-23")
    await user.click(screen.getByRole("button", { name: "이 날짜로 배치 미리보기" }))

    expect(screen.getByRole("heading", { name: "아직 경기 날짜를 계획에 적용할 수 없어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /선택하기|계획 시작|저장/u })).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    expect(JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
      url: window.location.href,
      history: window.history.state,
    })).not.toContain("2099-08-23")

    await user.click(screen.getByRole("button", { name: "날짜 없이 일반 계획 보기" }))
    expectGeneratedCandidates()
    expect(screen.getByText("경기 날짜 없이 만든 일반 계획")).toBeInTheDocument()
  })

  it("rechecks recent journal safety when a refinement regenerates the plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerQuickPlanQuestions("clear")
    expectGeneratedCandidates()

    const date = todayISO()
    expect(saveEntry({
      id: "risk-added-during-refinement",
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

    await openRefinement("훈련 종류")
    await user.click(screen.getByRole("button", { name: /조금 힘들게 꾸준히.*LT/u }))

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "계획이 준비됐어요" }))
      .not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("starts a returning athlete at the safety question when the saved intake is complete", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(stateFixture().intake),
    )

    render(<PlanBeta />)

    expect(screen.getByRole("heading", { name: "지금 몸은 어때요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expectGeneratedCandidates()
  })

  it("fills a legacy intake that lacks a division with the omitted value instead of asking", async () => {
    const user = userEvent.setup()
    const { competitionDivision: _omitted, ...legacyIntake } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(legacyIntake),
    )

    render(<PlanBeta />)

    expect(screen.queryByRole("heading", { name: /부문/u })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "지금 몸은 어때요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expectGeneratedCandidates()
    expect(screen.getByRole("button", { name: /^참가 부문 바꾸기 · 지금 선택하지 않음/u })).toBeInTheDocument()
  })

  it("requires an exact event before reusing a legacy general-endurance intake", async () => {
    const user = userEvent.setup()
    const {
      competitionDivision: _division,
      eventDistanceM: _distance,
      selectedDetailedTemplateRef: _template,
      ...legacyIntake
    } = {
      ...stateFixture().intake,
      eventGroup: "GENERAL_ENDURANCE" as const,
    }
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(legacyIntake),
    )

    render(<PlanBeta />)

    expect(screen.getByRole("heading", { name: "어떤 달리기를 준비할까요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^5000m/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))

    expectGeneratedCandidates()
  })

  it("rejects a v3 active plan whose exact target conflicts with legacy general endurance", () => {
    const state = stateFixture()
    const { competitionDivision: _division, ...legacyIntake } = state.intake
    expect(savePlanBetaState({
      ...state,
      intake: { ...legacyIntake, eventGroup: "GENERAL_ENDURANCE" },
    })).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("reuses every explicit saved refinement without asking again", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify({
        ...stateFixture().intake,
        competitionDivision: "HIGH_SCHOOL",
        availableDayCount: 6,
        requestedFrameLength: 10,
        trainingFocus: "VO2_INTENT",
        trainingTimePreference: "EVENING",
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      }),
    )

    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))

    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
    expect(screen.getAllByText(/5km.*10일/u)).not.toHaveLength(0)
    expect(screen.getAllByText(/숨차게 반복.*VO₂/u)).not.toHaveLength(0)
    expect(screen.getByText("5개 바꿨어요")).toBeVisible()
    expect(screen.getByRole("button", { name: /^참가 부문 바꾸기 · 지금 고등부/u, hidden: true })).toBeInTheDocument()
  })

  it("routes a missing stored focus to candidates with the base default", async () => {
    const user = userEvent.setup()
    const state = stateFixture()
    const { trainingFocus: _focus, ...partialIntake } = state.intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partialIntake),
    )

    render(<PlanBeta />)
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))

    expectGeneratedCandidates()
    expect(screen.getByRole("button", { name: /^훈련 종류 바꾸기 · 지금 골고루/u })).toBeInTheDocument()
  })

  it("persists every explicit answer while keeping the next frame locked until completion", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await answerQuickPlanQuestions("clear", { days: /^6일/u })
    await openRefinement("훈련 종류")
    await user.click(screen.getByRole("button", { name: /숨차게 반복.*VO₂/u }))
    await openRefinement("달력 길이")
    await user.click(screen.getByRole("button", { name: /10일 계획 받기/u }))
    await openRefinement("시간대")
    await user.click(screen.getByRole("button", { name: /저녁에 운동해요/u }))
    await openRefinement("하루 두 번")
    await user.click(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
    const [choice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)

    expect(loadPlanBetaState()?.intake).toMatchObject({
      trainingFocus: "VO2_INTENT",
      availableDayCount: 6,
      requestedFrameLength: 10,
      trainingTimePreference: "EVENING",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
    })
    expect(loadPreviousIntake()).toBeNull()
    expect(screen.getByRole("button", { name: "현재 계획을 먼저 기록해 주세요" }))
      .toBeDisabled()
  })

  it("explains that managing race records does not automatically change this beta plan", () => {
    // Given
    render(<PlanBeta />)

    // Then
    expect(screen.getByRole("radio", { name: "내 기록" })).toBeVisible()
    expect(screen.getByText("입력한 현재 기록은 내 기록에도 남아요.")).toBeInTheDocument()
  })

  it("reads a detailed notation without storing or creating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByText("기록 관리·훈련표 읽기"))
    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    expect(screen.getByRole("heading", { name: "훈련표 표기 읽기" })).toBeVisible()
    expect(screen.getByText("훈련 표기 읽기", { selector: ".plan-eyebrow" })).toBeVisible()

    await user.type(
      screen.getByRole("textbox", { name: "훈련표 표기" }),
      "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND",
    )
    await user.click(screen.getByRole("button", { name: "표기 풀어보기" }))

    const results = screen.getByRole("region", { name: "훈련표 표기 결과" })
    expect(within(results).getByText("20회")).toBeVisible()
    expect(within(results).getByText("8,000m")).toBeVisible()
    expect(within(results).getByText("60초 · 18번")).toBeVisible()
    expect(within(results).getByText("3분 · 1번")).toBeVisible()
    expect(within(results).getByText("1,260초")).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("shows an error for an incomplete notation without creating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByText("기록 관리·훈련표 읽기"))
    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    await user.type(screen.getByRole("textbox", { name: "훈련표 표기" }), "10×400m")
    await user.click(screen.getByRole("button", { name: "표기 풀어보기" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "아직 이 표기 형식은 읽지 못해요",
    )
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("explains frame length and two-a-day only inside refine, with a help icon on the days question", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await enterPlanWithoutRecord()
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    const availableDaysHelp = screen.getByRole("button", {
      name: "이번 계획에서 운동할 날 설명 보기",
    })
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "false")
    await user.click(availableDaysHelp)
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "true")
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expectGeneratedCandidates()

    await openRefinement("달력 길이")
    expect(screen.getByRole("heading", { name: "며칠짜리 달력을 받을까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: /7일만 먼저 받기/u })).toHaveTextContent("다음 계획으로 이어서")
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    expectGeneratedCandidates()

    await openRefinement("하루 두 번")
    expect(screen.getByRole("heading", {
      name: "하루에 두 번 운동하는 날도 넣을까요?",
    })).toBeVisible()
    expect(screen.getByText("고르면 훈련일을 오전·오후 두 칸으로 나눠요.")).toBeVisible()
    expect(screen.queryByText(/오후 RPE 1~2 회복 운동만/u)).toBeNull()
  })

  it("never asks competition division up front; it is a refine item with the omitted default", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await enterPlanWithoutRecord(/^5000m/u)

    expect(screen.queryByRole("heading", { name: /부문/u })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
  })

  it("shows every supported high-intensity intention inside refine with a help icon", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await answerQuickPlanQuestions("clear")
    await openRefinement("훈련 종류")

    expect(screen.getByRole("button", { name: /조금 힘들게 꾸준히.*LT/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /숨차게 반복.*VO₂/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /짧고 세게.*GLY/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /스피드.*ATP-PC/u })).toBeVisible()

    const focusHelp = screen.getByRole("button", { name: "훈련 목적과 에너지 대사 설명 보기" })
    await user.click(focusHelp)
    expect(screen.getByText(/앱이 몸속 대사를 측정했다는 뜻은 아닙니다/u)).toBeVisible()
  })

  it("generates canonical candidates without storing until the athlete selects one", async () => {
    render(<PlanBeta />)

    await answerMinimumPlanQuestions()

    expectGeneratedCandidates()
  })

  it("blocks candidate selection when same-day structured pain appears after candidates render", async () => {
    // Given: candidates rendered under a clear current check, then explicit pain 5 is saved today.
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    expectGeneratedCandidates()
    const date = todayISO()
    expect(saveEntry({
      id: "risk-added-after-candidates",
      kind: "evening",
      date,
      savedAt: `${date}T10:00:00.000Z`,
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
    const [choice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")

    // When: the athlete selects a now-stale candidate.
    await user.click(choice)

    // Then: PlanBeta fails safe before activation or persistence.
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "계획이 준비됐어요" }))
      .not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("blocks generation when current risk is present or unclear", async () => {
    const onWriteLog = vi.fn()
    render(<PlanBeta onWriteLog={onWriteLog} />)

    await answerMinimumPlanQuestions("review")

    expect(screen.getByText("계획을 만들 수 없음", { selector: ".plan-eyebrow" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.getByText(/앱은 사람에게 자동으로 연결하거나 몸 상태를 확인할 수 없어요/u)).toBeVisible()
    expect(screen.getByText(/지도자·보호자 또는 의료진과 직접 상의해 주세요/u)).toBeVisible()
    expect(screen.queryByRole("heading", {
      name: "지속 페이스 포함",
    })).toBeNull()
    await userEvent.setup().click(
      screen.getByRole("button", { name: "지도자와 상의한 내용을 일지에 남기기" }),
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
    expect(screen.queryByRole("heading", { name: "계획 형태 미리보기" }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole("heading", {
      name: "지속 페이스 포함",
    })).toBeNull()
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
    expect(screen.queryByRole("heading", { name: "계획 형태 미리보기" }))
      .not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it.skip("does not inspect a private memo while generating candidates", async () => {
    const date = todayISO()
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    await expect(savePrivateEntry({
      id: "recent-private-note",
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
      memo: "무릎이 계속 아파요",
      memoPurpose: MEMO_PURPOSE.privateSelfOnly,
    })).resolves.toEqual({ ok: true, total: 1 })
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expectGeneratedCandidates()
    expect(screen.queryByText("무릎이 계속 아파요")).toBeNull()
  })

  it.skip("labels recent journals as context without using their values", async () => {
    savePostSession("recent-session-1")
    savePostSession("recent-session-2")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expectGeneratedCandidates()
    expect(screen.getByText(
      "경기 기록 0개 · 최근 일지 2개 연결",
    )).toBeVisible()
  })

  // 원래 이 테스트는 미래 날짜와 함께 "2026-02-31"(2월 31일)도 심었다.
  // 이제 그 날짜는 저장 관문(`journal-schema`의 `journalDateSchema`)에서
  // 막히므로 `saveEntry`로 심을 수 없다.
  //
  // 스키마를 우회해 저장소에 직접 심는 방법도 시도해 봤는데, 결함 주입으로
  // **헛돈다는 걸 확인했다**: `plan-beta-flow`의 `isValidIsoDate` 가드를
  // 지워도 이 테스트는 통과했다. `loadEntries()`가 스키마 단계에서 이미
  // 버리기 때문에 깨진 날짜는 flow까지 도달하지 못한다. 그래서 그 형태는
  // 검증하는 척만 하는 테스트였고, 남기지 않았다.
  //
  // 깨진 날짜를 읽을 때 버리는 계약은 저장/읽기 계층에서 고정한다:
  //   journal-date-validity.contract.test.ts D-1(저장 거부) · D-4(읽기 시 폐기)
  // 여기서는 이 화면이 실제로 책임지는 것 — 미래 날짜 — 만 고정한다.
  it("does not count future journal dates as recent context", async () => {
    savePostSession("future-session-1", "", undefined, "2099-01-01")
    savePostSession("future-session-2", "", undefined, "2099-01-02")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expectGeneratedCandidates()
    expect(screen.queryByText("최근 일지 확인 · 계획 수치에는 미반영")).toBeNull()
  })

  it("stores an active plan only after the athlete selects a candidate", async () => {
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()

    const [firstChoice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (!firstChoice) throw new Error("Expected at least one candidate choice")
    await userEvent.setup().click(firstChoice)

    expect(screen.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
    expect(screen.getByLabelText("9일 훈련 일정")).toBeVisible()
    expect(screen.queryByText("ACTIVE · LOCAL BETA")).toBeNull()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
  })

  it("blocks candidate save when journal JSON becomes corrupt after generation", async () => {
    // Given
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, "{")
    const [choice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")

    // When
    await user.click(choice)

    // Then
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("keeps candidate selection visible when the active plan cannot be saved", async () => {
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()

    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") throw new Error("QuotaExceededError")
      return realSetItem.call(this, key, value)
    })
    const [firstChoice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (!firstChoice) throw new Error("Expected at least one candidate choice")
    await userEvent.setup().click(firstChoice)

    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("button", { name: "저장 다시 시도" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("blocks save retry when analyzable D9 risk appears after the first write fails", async () => {
    // Given: the first plan write fails, then a local analyzable safety memo is saved.
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    const realSetItem = Storage.prototype.setItem
    let planWriteCount = 0
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") {
        planWriteCount += 1
        if (planWriteCount === 1) throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    const [choice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)
    expect(screen.getByRole("button", { name: "저장 다시 시도" })).toBeVisible()
    const rawRiskMemo = "무릎이 계속 아파요"
    savePostSession(
      "risk-added-before-save-retry",
      rawRiskMemo,
      MEMO_PURPOSE.analyzableTrainingNote,
    )

    // When: the athlete retries the stale selection.
    await user.click(screen.getByRole("button", { name: "저장 다시 시도" }))

    // Then: fresh D9 risk blocks before another write and raw memo text stays private.
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "저장 다시 시도" }))
      .not.toBeInTheDocument()
    expect(planWriteCount).toBe(1)
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    expect(screen.queryByText(rawRiskMemo)).not.toBeInTheDocument()
  })

  it("blocks save retry when reading journal storage throws", async () => {
    // Given
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    const realSetItem = Storage.prototype.setItem
    let planWriteCount = 0
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") {
        planWriteCount += 1
        if (planWriteCount === 1) throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    const [choice] = screen.getAllByRole("button", { name: /선택하기|이 계획으로 시작하기|이 일정으로 시작/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)
    expect(screen.getByRole("button", { name: "저장 다시 시도" })).toBeVisible()
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === JOURNAL_STORAGE_KEY) throw new Error("journal read failed")
      return realGetItem.call(this, key)
    })

    // When
    await user.click(screen.getByRole("button", { name: "저장 다시 시도" }))

    // Then
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(planWriteCount).toBe(1)
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("keeps the current plan active and writes no history before the frame is complete", () => {
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    render(<PlanBeta />)

    expect(screen.getByRole("button", { name: "현재 계획을 먼저 기록해 주세요" }))
      .toBeDisabled()
    expect(screen.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
    expect(window.localStorage.getItem("trainoracle.plan-beta.history.v1")).toBeNull()
  })

  it("does not mark progress complete when that update cannot be saved", async () => {
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    render(<PlanBeta />)
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") throw new Error("QuotaExceededError")
      return realSetItem.call(this, key, value)
    })

    const user = userEvent.setup()
    await user.click(screen.getAllByText(/훈련 방법과 기록/u)[0]!)
    const progress = screen.getByLabelText(/DAY 1.*진행 기록/u)
    await user.click(within(progress).getByRole("button", { name: "완료" }))

    expect(screen.getByRole("alert")).toHaveTextContent("진행 기록 저장을 되돌렸는지 확인할 수 없어요")
    expect(screen.queryByRole("button", { name: "진행 상태 다시 저장하기" })).not.toBeInTheDocument()
    expect(screen.getByText("예정")).toBeVisible()
    expect(screen.queryByText("완료", { selector: "em" })).toBeNull()
  })
})

