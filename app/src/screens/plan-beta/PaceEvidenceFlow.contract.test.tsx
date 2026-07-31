import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { AthleteRecord } from "../../domain/athlete-records"
import { PaceEvidenceFlow } from "./PaceEvidenceFlow"

afterEach(cleanup)

const RECORDS: readonly AthleteRecord[] = [
  {
    schemaVersion: 1,
    id: "pb-5000-1110",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-05-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5000-1110",
    savedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    schemaVersion: 1,
    id: "goal-5000-1050",
    purpose: "RACE_GOAL",
    eventDistanceM: 5000,
    performanceSeconds: 1050,
    achievedOn: null,
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:goal-5000-1050",
    savedAt: "2026-07-30T00:00:00.000Z",
  },
]

function clearedGate() {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    evidence: [],
  }))
}

function renderFlow() {
  render(
    <PaceEvidenceFlow
      records={RECORDS}
      notation="5×1000m @5000m RP · r150″"
      template={{ lifecycleStatus: "ACTIVE", eligibilityStatus: "ELIGIBLE" }}
      safetyGate={clearedGate()}
      today={new Date("2026-07-30T12:00:00.000Z")}
    />,
  )
}

describe("P3 explicit pace evidence flow", () => {
  it("starts with no selected record and no numeric target", () => {
    renderFlow()

    expect(screen.getByRole("heading", { name: "기준 기록을 고르세요" })).toBeVisible()
    expect(screen.queryByText(/3분 42초/u)).toBeNull()
    expect(screen.queryByText(/3분 30초/u)).toBeNull()
  })

  it("requires a separate currentness confirmation before showing numbers", async () => {
    const user = userEvent.setup()
    renderFlow()

    await user.click(screen.getByRole("button", {
      name: /개인 최고.*5000m.*18분 30초/u,
    }))
    expect(screen.getByRole("heading", {
      name: "이 기록이 지금 실력을 나타내나요?",
    })).toBeVisible()
    expect(screen.queryByText(/3분 42초/u)).toBeNull()

    await user.click(screen.getByRole("button", {
      name: /^현재 실력으로 사용/u,
    }))

    expect(screen.getByText("오늘 반복 목표")).toBeVisible()
    expect(screen.getByText("3분 42초")).toBeVisible()
    expect(screen.getByText("목표 기록 기준")).toBeVisible()
    expect(screen.getByText(/3분 30초.*참고용/u)).toBeVisible()
    expect(screen.getByText("목표 기록은 오늘 지시가 아니에요.")).toBeVisible()
    expect(screen.getByText(/직접 입력.*자기 보고/u)).toBeVisible()
  })

  it.each([
    ["참고 기록으로만 보기", "이 기록은 참고용으로 선택됐어요."],
    ["아직 모르겠어요", "현재 실력인지 확인이 필요해요."],
  ] as const)("removes numeric targets for %s", async (choice, message) => {
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByRole("button", {
      name: /개인 최고.*5000m.*18분 30초/u,
    }))

    await user.click(screen.getByRole("button", {
      name: new RegExp(`^${choice}`, "u"),
    }))

    expect(screen.getByText(message)).toBeVisible()
    expect(screen.getByText("숫자 페이스 대신 체감강도로 안내합니다.")).toBeVisible()
    expect(screen.queryByText(/3분 42초/u)).toBeNull()
    expect(screen.queryByText(/3분 30초/u)).toBeNull()
  })
})
