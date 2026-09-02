import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ATHLETE_RECORDS_STORAGE_KEY } from "../../domain/athlete-records"
import { PlanBeta } from "../PlanBeta"
import * as mutationLock from "../../domain/plan-mutation-lock"

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

afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function reachCandidates(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /^5000m/u }))
  await user.click(screen.getByRole("button", { name: /일반부/u }))
  await user.click(screen.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
  await user.click(screen.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }))
  await user.click(screen.getByRole("button", {
    name: /5000m 경기 페이스 상세 훈련 포함/u,
  }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: "날짜 없이 계획안 보기" }))
}

describe("production detailed prescription experience", () => {
  it("changes method in place, preserves the start date, and requires pace reconfirmation", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await reachCandidates()
    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    for (const article of document.querySelectorAll(".plan-candidate")) {
      const labelledBy = article.getAttribute("aria-labelledby")!
      expect(labelledBy).not.toMatch(/[\s{}"\[\]]/u)
      expect(document.getElementById(labelledBy)?.tagName).toBe("H2")
    }
    fireEvent.change(screen.getByLabelText("계획 시작 날짜"), { target: { value: "2026-09-10" } })
    await user.click(screen.getByText("훈련 방법 선택"))
    await user.click(screen.getByRole("radio", { name: /시간·RPE 기준으로 받기/u }))
    expect(screen.queryByRole("region", { name: "개인 페이스 기준 기록" })).toBeNull()
    expect(screen.queryByText(/5×1000m @5000m RP/u)).toBeNull()
    expect(screen.getByLabelText("계획 시작 날짜")).toHaveValue("2026-09-10")
    expect(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeEnabled()
    await user.click(screen.getByRole("radio", { name: /1000m 5회/u }))
    expect(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeDisabled()
    expect(screen.queryByText(/5×1000m @5000m RP/u)).toBeNull()
    expect(screen.queryByText(/직접 고르고 확인한 현재.*기록으로 한 강도 세션의 상세 페이스/u)).toBeNull()
    expect(screen.queryByText(/선택하고 확인한.*기록만 상세 페이스 계산에 사용/u)).toBeNull()
    const again = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    expect(within(again).getByText(/기준 기록.*18분 31초/u)).toBeVisible()
    await user.click(within(again).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    expect(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    await screen.findByRole("heading", { name: /9일 훈련 계획/u })
    const stored = JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!)
    expect(stored.intake.startDate).toBe("2026-09-10")
    expect(stored.intake.selectedDetailedTemplateRef.templateId).toBe("V2-SEED-05")
    expect(stored.activePlan.sessions.filter((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET")).toHaveLength(1)
  }, 15_000)

  it.each(["method", "record", "back", "date", "unmount"] as const)("invalidates an outstanding save after changing %s", async change => {
    const user = userEvent.setup()
    const view = render(<PlanBeta />)
    await reachCandidates()
    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    let release: (() => void) | undefined
    const lock: mutationLock.PlanMutationLockManager = {
      request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
        new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
    }
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue(lock)
    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    expect(release).toBeTypeOf("function")
    if (change === "method") {
      await user.click(screen.getByText("훈련 방법 선택"))
      await user.click(screen.getByRole("radio", { name: /시간·RPE 기준으로 받기/u }))
    } else if (change === "record") {
      await user.click(within(picker).getByRole("button", { name: /^시즌 최고.*19분/u }))
    } else if (change === "date") {
      fireEvent.change(screen.getByLabelText("계획 시작 날짜"), { target: { value: "2026-09-15" } })
    } else if (change === "unmount") {
      view.unmount()
    } else await user.click(screen.getByRole("button", { name: "질문 다시 보기" }))
    await act(async () => { release!() })
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    expect(screen.queryByRole("heading", { name: /9일 훈련 계획/u })).toBeNull()
    expect(screen.queryByRole("button", { name: "계획 다시 저장하기" })).toBeNull()
  }, 15_000)

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
    expect(within(schedule).getByText("총 5회 · 주요 구간 5000m · 1000m당 3분 42초")).toBeVisible()
    expect(within(schedule).getAllByText(/5회.*5000m/u)).not.toHaveLength(0)
    expect(within(schedule).getByText(/4번.*150초.*조깅.*600초/u)).toBeVisible()
    await user.click(within(schedule).getByText("기준 기록·중단·낮춤 규칙 보기"))
    expect(within(schedule).getByText(/5000m.*18분 31초.*2026-05-10/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    await screen.findByRole("heading", { name: /9일 훈련 계획/u })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("시간 조절 계획")).toBeVisible()
    const activeSession = await openDetailedActiveSession(user)
    const activeNotation = within(activeSession).getByText(/5×1000m @5000m RP.*r150.*JOG/u)
    expect(activeNotation).toBeVisible()
    await user.click(within(activeSession).getByText("시작 전 확인"))
    const startButton = within(activeSession).getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" })
    const reviewButton = within(activeSession).getByRole("button", { name: "통증·이상 또는 잘 모르겠음" })
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
    const reloadedSession = await openDetailedActiveSession(user)
    expect(within(reloadedSession).getByText(/5×1000m @5000m RP.*r150.*JOG/u)).toBeVisible()
    await user.click(within(reloadedSession).getByText("기준 기록·중단·낮춤 규칙 보기"))
    expect(within(reloadedSession).getByText(/5000m.*18분 31초.*2026-05-10/u)).toBeVisible()
  }, 15_000)

  it("clears the execution allowance message on every recorded outcome", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await reachCandidates()

    const picker = screen.getByRole("region", { name: "개인 페이스 기준 기록" })
    await user.click(within(picker).getByRole("button", { name: /개인 최고.*18분 31초/u }))
    await user.click(within(picker).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    await user.click(screen.getByRole("button", { name: /시간 조절 계획 선택하기/u }))
    await screen.findByRole("heading", { name: /9일 훈련 계획/u })

    const activeSession = await openDetailedActiveSession(user)

    // RESTED clears the START allowance message and removes start/restart
    await user.click(within(activeSession).getByText("시작 전 확인"))
    await user.click(within(activeSession).getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" }))
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
  }, 15_000)

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
    expect(screen.getByText(/두 계획안 모두 원래 RPE 계획을 유지합니다/u)).toBeVisible()
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

async function openDetailedActiveSession(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  const sessionTitle = screen.getAllByText(/강한 유산소 반복 · VO₂ 훈련/u)[0]
  const session = sessionTitle?.closest("section[role='group']")
  if (!(session instanceof HTMLElement)) throw new Error("Expected the detailed active session")
  const details = within(session).getByText(/훈련 방법과 기록/u).closest("details")
  if (!(details instanceof HTMLDetailsElement)) throw new Error("Expected active session details")
  if (!details.open) await user.click(within(details).getByText(/훈련 방법과 기록/u))
  return session
}
