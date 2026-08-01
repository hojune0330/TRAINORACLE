import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FIELD_PROVENANCE } from "../domain/field-provenance"
import { MEMO_PURPOSE } from "../domain/journal-schema"
import { saveEntry, savePrivateEntry, todayISO } from "../domain/journal-store"
import { createRecoveryCode } from "../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../domain/account/private-note-sync"
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
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획.*권장/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
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

  it("explains plan availability and frame choices before selection", async () => {
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
    expect(screen.getByRole("button", {
      name: "계획 길이 설명 보기",
    })).toBeVisible()
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

  it("creates two profile-only candidates without journal data", async () => {
    render(<PlanBeta />)

    await answerMinimumPlanQuestions()

    expect(screen.getByRole("heading", {
      name: "두 계획에서 하나를 골라보세요",
    })).toBeVisible()
    expect(screen.getByRole("heading", {
      name: "지속 페이스 포함",
    })).toBeVisible()
    expect(screen.getByRole("heading", {
      name: "기초 지구력 중심",
    })).toBeVisible()
    expect(screen.getByText(
      "운동 3회 · 기초 지구력 2일 · 지속 페이스 1일 · 완전 휴식 6일",
    )).toBeVisible()
    expect(screen.getAllByText(/기초 지구력.*BASE/u).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/지속 페이스.*LT/u).length).toBeGreaterThan(0)

    const rpeHelp = screen.getAllByRole("button", { name: "RPE 설명 보기" })[0]
    expect(rpeHelp).toBeDefined()
    if (rpeHelp !== undefined) {
      await userEvent.setup().click(rpeHelp)
      expect(screen.getByText(/1~2는 빨리 걷기/u)).toBeVisible()
    }

    const guidance = screen.getAllByText("실행 방법 보기")[0]
    expect(guidance).toBeDefined()
    if (guidance !== undefined) {
      await userEvent.setup().click(guidance)
      const openedGuidance = guidance.closest("details")
      expect(openedGuidance).not.toBeNull()
      if (openedGuidance !== null) {
        expect(within(openedGuidance).getByText(
          /친구와 대화하거나 전화 통화는 가능한 정도/u,
        )).toBeVisible()
      }
    }
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

  it("does not inspect a private memo while checking recent journal risk", async () => {
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

    expect(screen.getByRole("heading", {
      name: "두 계획에서 하나를 골라보세요",
    })).toBeVisible()
  })

  it("labels journal presence honestly when its values do not alter prescriptions", async () => {
    savePostSession("recent-session-1")
    savePostSession("recent-session-2")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByText("최근 일지 확인 · 계획 수치에는 미반영")).toBeVisible()
    expect(screen.getByText(/일지의 거리, RPE, 메모는 이번 베타 계획/u)).toBeVisible()
  })

  it("does not label future or calendar-invalid entries as recent journal context", async () => {
    savePostSession("future-session-1", "", undefined, "2099-01-01")
    savePostSession("future-session-2", "", undefined, "2099-01-02")
    savePostSession("invalid-session", "", undefined, "2026-02-31")
    render(<PlanBeta />)

    await answerMinimumPlanQuestions("clear")

    expect(screen.getByText("사용 정보 6가지 · 베타 계획")).toBeVisible()
    expect(screen.queryByText("최근 일지 확인 · 계획 수치에는 미반영")).toBeNull()
  })

  it("selects a candidate, stores it locally, and records progress without points", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()

    await user.click(screen.getByRole("button", {
      name: "지속 페이스 포함 선택하기",
    }))

    expect(screen.getByRole("heading", {
      name: "지속 페이스 포함 9일 계획",
    })).toBeVisible()
    const dayOneActions = screen.getByLabelText("DAY 1 오전 진행 기록")
    await user.click(within(dayOneActions).getByRole("button", { name: "완료" }))

    const stored = window.localStorage.getItem("trainoracle.plan-beta.v1")
    expect(stored).toContain("\"state\":\"COMPLETED\"")
    expect(stored).not.toMatch(/point|reward|memo|symptom/u)
  })

  it("carries structured progress into the next frame without automatic progression", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await answerMinimumPlanQuestions()
    await user.click(screen.getByRole("button", {
      name: "기초 지구력 중심 선택하기",
    }))
    await user.click(
      within(screen.getByLabelText("DAY 1 오전 진행 기록"))
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
