import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FIELD_PROVENANCE } from "../domain/field-provenance"
import { MEMO_PURPOSE } from "../domain/journal-schema"
import { saveEntry, savePrivateEntry, todayISO } from "../domain/journal-store"
import { savePlanBetaState } from "../domain/plan-beta-store"
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
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
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
  it("reads a detailed notation without storing or creating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    expect(screen.getByRole("heading", { name: "훈련표 표기 읽기" })).toBeVisible()

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
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
    await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))

    const availableDaysHelp = screen.getByRole("button", {
      name: "훈련할 수 있는 날 설명 보기",
    })
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "false")
    await user.click(availableDaysHelp)
    expect(availableDaysHelp).toHaveAttribute("aria-expanded", "true")

    await user.click(screen.getByRole("button", { name: /^3일/u }))
    expect(screen.getByRole("heading", {
      name: "하루에 두 번 운동하는 날도 넣을까요?",
    })).toBeVisible()
    expect(screen.queryByRole("button", { name: /7일 계획|9일 계획|10일 계획/u })).toBeNull()
  })

  it("shows every supported high-intensity intention before generating a plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)

    await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
    await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))

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

  it("blocks generation when current risk is present or unclear", async () => {
    const onWriteLog = vi.fn()
    render(<PlanBeta onWriteLog={onWriteLog} />)

    await answerMinimumPlanQuestions("review")

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.getByText(/앱은 사람에게 자동으로 연결하거나 몸 상태를 확인할 수 없어요/u)).toBeVisible()
    expect(screen.getByText(/지도자·보호자 또는 의료진과 직접 상의해 주세요/u)).toBeVisible()
    expect(screen.queryByRole("heading", {
      name: "지속 페이스 포함",
    })).toBeNull()
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
    expect(screen.getAllByText("최근 일지 확인 · 계획 수치에는 미반영")[0]).toBeVisible()
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
    expect(firstChoice).toBeDefined()
    await userEvent.setup().click(firstChoice!)

    expect(screen.getByRole("heading", { name: /9.5일 계획/u })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
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
    await userEvent.setup().click(firstChoice!)

    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
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
