import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ATHLETE_RECORDS_STORAGE_KEY } from "../../domain/athlete-records"
import { PlanBeta } from "../PlanBeta"

const RECORDS = [
  {
    schemaVersion: 1,
    id: "pb-5k-current",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1111,
    achievedOn: "2026-05-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5k-current",
    savedAt: "2026-05-10T12:00:00.000Z",
  },
  {
    schemaVersion: 1,
    id: "sb-5k-current",
    purpose: "SEASON_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1140,
    achievedOn: "2026-04-20",
    seasonId: "2026",
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:sb-5k-current",
    savedAt: "2026-04-20T12:00:00.000Z",
  },
] as const

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify(RECORDS))
})

afterEach(cleanup)

async function reachCandidates(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /^5000m/u }))
  await user.click(screen.getByRole("button", { name: /일반부/u }))
  await user.click(screen.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
  await user.click(screen.getByRole("button", { name: /반복 인터벌.*VO2/u }))
  await user.click(screen.getByRole("button", {
    name: /5000m 경기 페이스 상세 훈련 포함/u,
  }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: "날짜 없이 계획 후보 보기" }))
}

describe("production detailed prescription experience", () => {
  it("binds only the confirmed record and preserves the exact prescription after reload", async () => {
    const user = userEvent.setup()
    const firstRender = render(<PlanBeta />)
    await reachCandidates()

    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    const comparison = screen.getByRole("region", { name: "두 계획 핵심 비교" })
    expect(picker.compareDocumentPosition(comparison))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: /비교 기록.*시즌 최고.*19분/u }))
    expect(within(picker).getByText(/기준 기록.*18분 31초/u)).toBeVisible()
    expect(within(picker).getByText(/비교만.*19분/u)).toBeVisible()

    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))

    const schedule = screen.getAllByRole("list", { name: "날짜별 계획 미리보기" })[0]
    if (schedule === undefined) throw new Error("Expected an expanded candidate schedule")
    expect(within(schedule).getByText(/5×1000m @5000m RP.*r150.*JOG/u)).toBeVisible()
    expect(within(schedule).getByText("총 5회 · 품질 거리 5000m · 1000m 3분 42초")).toBeVisible()
    expect(within(schedule).getAllByText(/5회.*5000m/u)).not.toHaveLength(0)
    expect(within(schedule).getByText(/4번.*150초.*조깅.*600초/u)).toBeVisible()
    await user.click(within(schedule).getByText("기준 기록·중단·낮춤 규칙 보기"))
    expect(within(schedule).getByText(/5000m.*18분 31초.*2026-05-10/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    await screen.findByRole("heading", { name: /시간 조절 계획 9일 계획/u })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("heading", { name: /시간 조절 계획 9일 계획/u })).toBeVisible()
    const activeNotation = screen.getByText(/5×1000m @5000m RP.*r150.*JOG/u)
    expect(activeNotation).toBeVisible()
    const activeSession = activeNotation.closest("section[role='group']")
    if (!(activeSession instanceof HTMLElement)) throw new Error("Expected the detailed active session")
    await user.click(screen.getByText("시작 전 확인"))
    const startButton = screen.getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" })
    const reviewButton = screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" })
    expect(startButton).toHaveClass("active-plan__execution-primary")
    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같음 · 다시 시작 확인" })).toBeNull()
    expect(reviewButton).toHaveClass("active-plan__execution-review")
    await user.click(startButton)
    expect(screen.getByText(/현재 안전 상태.*시작할 수 있어요/u)).toBeVisible()

    const completedButton = within(activeSession).getByRole("button", { name: "완료" })
    await user.click(completedButton)
    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" })).toBeNull()
    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같음 · 다시 시작 확인" })).toBeNull()
    expect(screen.queryByText(/현재 안전 상태.*시작할 수 있어요/u)).toBeNull()
    expect(screen.getByText(/이미 결과를 기록한 세션은 다시 시작하지 않아요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" })).toBeVisible()

    const painButton = within(activeSession).getByRole("button", { name: "통증 체크" })
    await user.click(painButton)
    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" })).toBeNull()
    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같음 · 다시 시작 확인" })).toBeNull()
    expect(screen.queryByText(/현재 안전 상태.*시작할 수 있어요/u)).toBeNull()
    expect(screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" })).toBeVisible()

    firstRender.unmount()
    render(<PlanBeta />)
    expect(screen.getByText(/5×1000m @5000m RP.*r150.*JOG/u)).toBeVisible()
    await user.click(screen.getByText("기준 기록·중단·낮춤 규칙 보기"))
    expect(screen.getByText(/5000m.*18분 31초.*2026-05-10/u)).toBeVisible()
  }, 15_000)

  it("clears the execution allowance message on every recorded outcome", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await reachCandidates()

    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    await screen.findByRole("heading", { name: /시간 조절 계획 9일 계획/u })

    const activeNotation = screen.getByText(/5×1000m @5000m RP.*r150.*JOG/u)
    const activeSession = activeNotation.closest("section[role='group']")
    if (!(activeSession instanceof HTMLElement)) throw new Error("Expected the detailed active session")

    // RESTED clears the START allowance message and removes start/restart
    await user.click(screen.getByText("시작 전 확인"))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" }))
    expect(screen.getByText(/현재 안전 상태.*시작할 수 있어요/u)).toBeVisible()
    await user.click(within(activeSession).getByRole("button", { name: "휴식" }))
    expect(screen.queryByText(/현재 안전 상태.*시작할 수 있어요/u)).toBeNull()
    expect(screen.queryByRole("button", { name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u })).toBeNull()

    // SKIPPED clears a review message raised after the outcome
    await user.click(screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" }))
    expect(screen.getByText(/지금은 상세 세션을 시작하지 않아요/u)).toBeVisible()
    await user.click(within(activeSession).getByRole("button", { name: "건너뜀" }))
    expect(screen.queryByText(/지금은 상세 세션을 시작하지 않아요/u)).toBeNull()
    expect(screen.queryByRole("button", { name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u })).toBeNull()

    // PAIN_CHECKIN clears any remaining message and keeps only the review path
    await user.click(screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" }))
    expect(screen.getByText(/지금은 상세 세션을 시작하지 않아요/u)).toBeVisible()
    await user.click(within(activeSession).getByRole("button", { name: "통증 체크" }))
    expect(screen.queryByText(/지금은 상세 세션을 시작하지 않아요/u)).toBeNull()
    expect(screen.getByText("통증 기록 후 확인")).toBeVisible()
    expect(screen.queryByRole("button", { name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u })).toBeNull()
    expect(screen.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" })).toBeVisible()
  })

  it("requires reconfirmation after replacing a confirmed record", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await reachCandidates()

    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    expect(screen.getAllByText(/5×1000m @5000m RP.*r150.*JOG/u)).not.toHaveLength(0)

    await user.click(within(picker).getByRole("button", { name: /^시즌 최고.*19분/u }))
    expect(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeDisabled()
    expect(screen.queryByText(/5×1000m @5000m RP.*r150.*JOG/u)).toBeNull()

    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    expect(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeEnabled()
    expect(screen.getAllByText(/5000m.*19분.*2026-04-20/u)).not.toHaveLength(0)
  })
  it("keeps both candidates RPE-only when the confirmed record is stale", async () => {
    const stale = [{ ...RECORDS[0], id: "pb-5k-stale", achievedOn: "2024-01-01", sourceRef: "athlete-record:pb-5k-stale" }]
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify(stale))
    const user = userEvent.setup()
    render(<PlanBeta />)
    await reachCandidates()

    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))

    expect(within(picker).getByText(/기록일이 현재 기준 범위를 벗어났어요/u)).toBeVisible()
    expect(screen.queryByText(/5×1000m @5000m RP/u)).toBeNull()
    expect(screen.getByText(/두 후보 모두 원래 RPE 계획을 유지합니다/u)).toBeVisible()
  })

  it("shows a plain RPE fallback when no record exists", async () => {
    window.localStorage.removeItem(ATHLETE_RECORDS_STORAGE_KEY)
    render(<PlanBeta />)
    await reachCandidates()

    expect(screen.getByText(/사용할 수 있는 경기 기록이 없어 RPE 계획/u)).toBeVisible()
    expect(screen.queryByText(/5×1000m @5000m RP/u)).toBeNull()
  })

  it("blocks at D9 before producing candidates", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await user.click(screen.getByRole("button", { name: /^5000m/u }))
    await user.click(screen.getByRole("button", { name: /일반부/u }))
    await user.click(screen.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }))
    await user.click(screen.getByRole("button", { name: /통증.*부상.*몸 이상/u }))

    expect(screen.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
    expect(screen.queryByText("선택 가능한 계획 2가지")).toBeNull()
  })
})
