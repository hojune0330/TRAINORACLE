import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FIELD_PROVENANCE } from "../domain/field-provenance"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-local-storage"
import { MEMO_PURPOSE } from "../domain/journal-schema"
import { saveEntry, savePrivateEntry, todayISO } from "../domain/journal-store"
import { loadPreviousIntake, savePlanBetaState } from "../domain/plan-beta-store"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { createRecoveryCode } from "../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../domain/account/private-note-sync"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function answerMinimumPlanQuestions(
  riskAnswer: "clear" | "review" = "clear",
): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", {
    name: riskAnswer === "clear"
      ? /통증은 없고 몸 상태는 평소와 같아요/u
      : /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u,
  }))
  if (riskAnswer === "review") return
  const continueButton = screen.queryByRole("button", { name: "내 계획 완성하기" })
  if (continueButton === null) return
  await user.click(continueButton)
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /날마다 달라요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
}

async function answerPreviewDecisions(
  riskAnswer: "clear" | "review",
): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", {
    name: riskAnswer === "clear"
      ? /통증은 없고 몸 상태는 평소와 같아요/u
      : /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u,
  }))
}

function expectGeneratedCandidates(): void {
  expect(screen.getByRole("heading", {
    name: "두 계획에서 하나를 골라보세요",
  })).toBeVisible()
  expect(screen.getAllByRole("button", { name: /선택하기/u })).toHaveLength(2)
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
  it("shows a non-selectable plan-shape preview after the required direction answers and a clear current-risk answer", async () => {
    render(<PlanBeta />)

    await answerPreviewDecisions("clear")

    expect(screen.getByRole("heading", { name: "계획 형태 미리보기" })).toBeVisible()
    expect(screen.getByText(
      /훈련일.*첫 계획 길이.*7.*9.*10.*훈련 목적.*시간.*하루 한 번.*두 번/u,
    )).toBeVisible()
    expect(screen.queryByRole("button", { name: /선택하기/u })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "두 계획에서 하나를 골라보세요" }))
      .not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()

    await userEvent.setup().click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    expect(screen.getByRole("heading", {
      name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
    })).toBeVisible()
  })

  it("shows no preview or candidates when the current-risk answer needs review after the required direction answers", async () => {
    render(<PlanBeta />)

    await answerPreviewDecisions("review")

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "계획 형태 미리보기" }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "두 계획에서 하나를 골라보세요" }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /선택하기/u })).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("rechecks recent journal safety after preview before generating candidates", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await answerPreviewDecisions("clear")
    expect(screen.getByRole("heading", { name: "계획 형태 미리보기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))

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

    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
    await user.click(screen.getByRole("button", { name: /^3일/u }))
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /날마다 달라요/u }))
    await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "두 계획에서 하나를 골라보세요" }))
      .not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("asks a returning athlete only for the newly required division before safety", async () => {
    const user = userEvent.setup()
    const { competitionDivision: _omitted, ...legacyIntake } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(legacyIntake),
    )

    render(<PlanBeta />)

    expect(screen.getByRole("heading", {
      name: "현재 참가하거나 준비 중인 부문이 있나요?",
    })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    expect(screen.getByRole("heading", {
      name: "계획을 만들기 전에 지금 몸 상태를 확인할게요",
    })).toBeVisible()
  })

  it("normalizes a legacy general-endurance previous intake before generating candidates", async () => {
    const user = userEvent.setup()
    const { competitionDivision: _division, ...legacyIntake } = {
      ...stateFixture().intake,
      eventGroup: "GENERAL_ENDURANCE" as const,
    }
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(legacyIntake),
    )

    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "계획 후보 만들기" }))

    expectGeneratedCandidates()
  })

  it("normalizes an archived general-endurance plan with no division before generating candidates", async () => {
    const user = userEvent.setup()
    const state = stateFixture()
    const { competitionDivision: _division, ...legacyIntake } = state.intake
    expect(savePlanBetaState({
      ...state,
      intake: { ...legacyIntake, eventGroup: "GENERAL_ENDURANCE" },
    })).toEqual({ ok: true })

    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: "다음 주기 후보 만들기" }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "계획 후보 만들기" }))

    expectGeneratedCandidates()
  })

  it("clears a stale omitted division and requires the current division before preview", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /기초 지구력.*경기 날짜 없이/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: "기초 지구력" }))
    await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))

    expect(screen.getByRole("heading", {
      name: "현재 참가하거나 준비 중인 부문이 있나요?",
    })).toBeVisible()
    expect(screen.getByRole("button", { name: /선택하지 않음.*나중에 입력/u }))
      .toHaveAttribute("aria-pressed", "false")

    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    const experienceChoices = screen.getAllByRole("button", {
      name: /훈련 계획에 맞춰 달려 본 경험/u,
    })
    const experienceChoice = experienceChoices.at(-1)
    if (experienceChoice === undefined) throw new Error("Expected the experience choice")
    await user.click(experienceChoice)
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))

    expect(screen.getByRole("heading", {
      name: "현재 참가하거나 준비 중인 부문이 있나요?",
    })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "계획 형태 미리보기" }))
      .not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /고등부/u }))
    expect(screen.getByRole("heading", {
      name: "계획을 만들기 전에 지금 몸 상태를 확인할게요",
    })).toBeVisible()
  })

  it("reuses every explicit saved refinement after the returning preview", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify({
        ...stateFixture().intake,
        availableDayCount: 6,
        requestedFrameLength: 10,
        trainingFocus: "VO2_INTENT",
        trainingTimePreference: "EVENING",
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      }),
    )

    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByText(/남은 선택 0개/u)).toHaveTextContent("저장된 선택을 그대로 다시 사용할 수 있어요")
    expect(screen.getByText(/남은 선택 0개/u)).toHaveTextContent("후보는 아직 만들지 않았어요")
    await user.click(screen.getByRole("button", { name: "계획 후보 만들기" }))

    expect(screen.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
    expect(screen.getAllByText(/5km.*10일/u)).not.toHaveLength(0)
    expect(screen.getAllByText(/반복 인터벌.*VO2/u)).not.toHaveLength(0)
    expect(screen.queryByRole("heading", {
      name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
    })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", {
      name: "이번 계획에서 운동할 수 있는 날은 며칠인가요?",
    })).not.toBeInTheDocument()
  })

  it("routes a missing stored focus to candidates without repeating saved refinements", async () => {
    const user = userEvent.setup()
    const state = stateFixture()
    const { trainingFocus: _focus, ...partialIntake } = state.intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partialIntake),
    )

    render(<PlanBeta />)
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByText(/남은 선택 1개/u)).toHaveTextContent("훈련 목적")
    expect(screen.queryByText(/훈련일.*첫 계획 길이.*주로 하는 시간.*하루 한 번/u))
      .not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))

    expectGeneratedCandidates()
    expect(screen.queryAllByRole("heading", {
      name: /이번 계획에서 운동할 수 있는 날|이번에 며칠 계획|주로 언제 운동|하루에 두 번 운동/u,
    })).toHaveLength(0)
  })

  it("preserves every explicit answer through the real saved-plan next-cycle path", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await answerPreviewDecisions("clear")
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /반복 인터벌.*VO2/u }))
    await user.click(screen.getByRole("button", { name: /^6일/u }))
    await user.click(screen.getByRole("button", { name: /10일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /저녁에 운동해요/u }))
    await user.click(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)
    await user.click(screen.getByRole("button", { name: "다음 주기 후보 만들기" }))

    expect(loadPreviousIntake()).toMatchObject({
      trainingFocus: "VO2_INTENT",
      availableDayCount: 6,
      requestedFrameLength: 10,
      trainingTimePreference: "EVENING",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
    })
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByText(/남은 선택 0개/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "계획 후보 만들기" }))

    expectGeneratedCandidates()
    expect(screen.queryByRole("heading", {
      name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
    })).not.toBeInTheDocument()
  })

  it("explains that managing race records does not automatically change this beta plan", () => {
    // Given
    render(<PlanBeta />)

    // Then
    expect(screen.getByText("목표 종목", { selector: ".plan-eyebrow" })).toBeVisible()
    expect(screen.getByText(
      "경기 기록을 저장해도 지금 계획의 페이스·거리·반복은 자동으로 바뀌지 않아요.",
    )).toBeVisible()
  })

  it("reads a detailed notation without storing or creating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    expect(screen.getByRole("heading", { name: "훈련표 표기 읽기" })).toBeVisible()
    expect(screen.getByText("훈련 표기 읽기", { selector: ".plan-eyebrow" })).toBeVisible()

    await user.type(
      screen.getByRole("textbox", { name: "훈련표 표기" }),
      "2×(10×400m) @5000m RP · r60″ · R3′",
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

    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    await user.type(screen.getByRole("textbox", { name: "훈련표 표기" }), "10×400m")
    await user.click(screen.getByRole("button", { name: "표기 풀어보기" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "아직 이 표기 형식은 읽지 못해요",
    )
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("explains plan availability and applies the 9.5-day frame without a dead-end choice", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))

    const availableDaysHelp = screen.getByRole("button", {
      name: "훈련할 수 있는 날 설명 보기",
    })
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "false")
    await user.click(availableDaysHelp)
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "true")

    await user.click(screen.getByRole("button", { name: /^3일/u }))
    expect(screen.getByRole("heading", { name: "이번에 며칠 계획을 받을까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: /7일만 먼저 받기/u })).toHaveTextContent("다음 계획으로 이어서")
    await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
    await user.click(screen.getByRole("button", { name: /날마다 달라요/u }))
    expect(screen.getByRole("heading", {
      name: "하루에 두 번 운동하는 날도 넣을까요?",
    })).toBeVisible()
    expect(screen.getByText(
      "고른 모든 훈련일을 오전과 오후 두 칸으로 나눠 보여줘요. 집중 훈련은 고른 시간대에, 다른 칸은 가벼운 훈련이나 회복으로 안내해요.",
    )).toBeVisible()
    expect(screen.queryByText(/오후 RPE 1~2 회복 운동만/u)).toBeNull()
    expect(screen.queryByRole("button", { name: /7일만 먼저 받기|9일 계획 받기|10일 계획 받기/u })).toBeNull()
  })

  it("skips competition division when the athlete chooses general endurance", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /기초 지구력.*경기 날짜 없이/u }))

    expect(screen.getByRole("heading", { name: "지금까지 어떤 방식으로 달려왔나요?" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: /참가하거나 준비 중인 부문/u })).toBeNull()
  })

  it("shows every supported high-intensity intention before generating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
    await user.click(screen.getByRole("button", { name: /고등부/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))

    expect(screen.getByRole("button", { name: /지속 페이스.*LT/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /반복 인터벌.*VO2/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /스피드 지구력.*GLY/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /짧고 빠른 가속.*ATP-PC/u })).toBeVisible()

    const focusHelp = screen.getByRole("button", { name: "훈련 목적 설명 보기" })
    await user.click(focusHelp)
    expect(screen.getByText(/앱이 몸속 에너지 시스템을 측정한 결과는 아닙니다/u)).toBeVisible()
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
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")

    // When: the athlete selects a now-stale candidate.
    await user.click(choice)

    // Then: PlanBeta fails safe before activation or persistence.
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "두 계획에서 하나를 골라보세요" }))
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

  it("does not inspect a private memo while generating candidates", async () => {
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

  it("labels recent journals as context without using their values", async () => {
    savePostSession("recent-session-1")
    savePostSession("recent-session-2")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expectGeneratedCandidates()
    expect(screen.getAllByText("내가 고른 조건으로 만든 계획 · 최근 기록 있음")[0]).toBeVisible()
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

    const [firstChoice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (!firstChoice) throw new Error("Expected at least one candidate choice")
    await userEvent.setup().click(firstChoice)

    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()
    expect(screen.getByText("내 훈련 일정")).toBeVisible()
    expect(screen.queryByText("ACTIVE · LOCAL BETA")).toBeNull()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
  })

  it("blocks candidate save when journal JSON becomes corrupt after generation", async () => {
    // Given
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, "{")
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
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
    const [firstChoice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (!firstChoice) throw new Error("Expected at least one candidate choice")
    await userEvent.setup().click(firstChoice)

    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
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
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)
    expect(screen.getByRole("button", { name: "계획 다시 저장하기" })).toBeVisible()
    const rawRiskMemo = "무릎이 계속 아파요"
    savePostSession(
      "risk-added-before-save-retry",
      rawRiskMemo,
      MEMO_PURPOSE.analyzableTrainingNote,
    )

    // When: the athlete retries the stale selection.
    await user.click(screen.getByRole("button", { name: "계획 다시 저장하기" }))

    // Then: fresh D9 risk blocks before another write and raw memo text stays private.
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "계획 다시 저장하기" }))
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
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await user.click(choice)
    expect(screen.getByRole("button", { name: "계획 다시 저장하기" })).toBeVisible()
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === JOURNAL_STORAGE_KEY) throw new Error("journal read failed")
      return realGetItem.call(this, key)
    })

    // When
    await user.click(screen.getByRole("button", { name: "계획 다시 저장하기" }))

    // Then
    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(planWriteCount).toBe(1)
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("keeps the current plan visible when next-frame archiving fails", async () => {
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.history.v1") {
        throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    render(<PlanBeta />)

    await userEvent.setup().click(
      screen.getByRole("button", { name: "다음 주기 후보 만들기" }),
    )

    expect(screen.getByRole("alert")).toHaveTextContent("지금 계획과 진행 기록은 그대로")
    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
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

    const progress = screen.getByLabelText(/DAY 1.*진행 기록/u)
    await userEvent.setup().click(within(progress).getByRole("button", { name: "완료" }))

    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByText("예정")).toBeVisible()
    expect(screen.queryByText("완료", { selector: "em" })).toBeNull()
  })
})

function firstUnpressedChoice(): HTMLButtonElement {
  const choice = screen.getAllByRole("button").find(
    (button) => button.getAttribute("aria-pressed") === "false",
  )
  if (choice === undefined) throw new Error("Expected an unanswered choice")
  return choice as HTMLButtonElement
}

async function answerReturningPreview(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(firstUnpressedChoice())
  const continueButton = document.querySelector<HTMLButtonElement>(".plan-preview-action")
  if (continueButton === null) throw new Error("Expected the preview continuation")
  await user.click(continueButton)
}

  it("routes a missing stored days answer to candidates", async () => {
    const user = userEvent.setup()
    const { availableDayCount: _days, ...partialIntake } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partialIntake),
    )
    render(<PlanBeta />)
    await answerReturningPreview(user)
    await user.click(firstUnpressedChoice())
    expectGeneratedCandidates()
  })

  it("routes a missing stored frame length to candidates", async () => {
    const user = userEvent.setup()
    const { requestedFrameLength: _frame, ...partialIntake } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partialIntake),
    )
    render(<PlanBeta />)
    await answerReturningPreview(user)
    await user.click(firstUnpressedChoice())
    expectGeneratedCandidates()
  })

  it("routes a missing stored training time to candidates", async () => {
    const user = userEvent.setup()
    const { trainingTimePreference: _time, ...partialIntake } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partialIntake),
    )
    render(<PlanBeta />)
    await answerReturningPreview(user)
    await user.click(firstUnpressedChoice())
    expectGeneratedCandidates()
  })
