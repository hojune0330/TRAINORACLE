import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "../../domain/athlete-records"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import {
  savePlanBetaState,
  type PlanBetaState,
} from "../../domain/plan-beta-store"
import {
} from "../../domain/plan-adaptation-ui"
import { saveSelectedPlanCandidate } from "./plan-selection"
import { PlanAdaptationFlow } from "./PlanAdaptationFlow"
import { PLAN_BETA_MUTATION_LOCK_NAME } from "../../domain/plan-mutation-lock"

const APPROVAL_5000 = DETAILED_PRESCRIPTION_APPROVALS.find(
  (approval) => approval.targetEventDistanceM === 5000,
)
if (APPROVAL_5000 === undefined) throw new TypeError("Expected approved 5000m fixture")
const TEMPLATE_5000 = {
  templateId: APPROVAL_5000.templateId,
  version: APPROVAL_5000.templateVersion,
  fingerprint: APPROVAL_5000.templateContentFingerprint,
} as const
let locksDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
        expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
        return callback({})
      },
    },
  })
})
afterEach(() => {
  if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
  else Object.defineProperty(navigator, "locks", locksDescriptor)
  cleanup()
})

describe("next-frame adaptation flow", () => {
  it("uses one decision per step, offers no raw text field, and keeps a no-op unchanged", async () => {
    const user = userEvent.setup()
    const { state } = await createBoundActivePlan()
    render(<PlanAdaptationFlow state={state} />)

    await openAdaptation(user)
    expect(screen.getByRole("heading", { name: "조정 이유를 선택해 주세요" })).toBeVisible()
    expect(screen.queryByText("훈련량을 조금 줄인 다음 계획")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
    expect(screen.getByRole("heading", { name: "현재 몸 상태를 확인해 주세요" })).toBeVisible()
    expect(screen.queryByText("훈련량을 조금 줄인 다음 계획")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByRole("heading", { name: "다음 계획의 기준을 선택해 주세요" })).toBeVisible()
    expect(screen.queryByText("최근 기록이 좋아졌어요")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /현재 계획과 같은 기준 유지/u }))
    expect(screen.getByRole("status")).toHaveTextContent("새 후보는 만들지 않았고 현재 계획도 그대로")
  })

  it("shows only strictly eligible same-event PB/SB records before the volume choice", async () => {
    const user = userEvent.setup()
    const { state } = await createBoundActivePlan()
    const now = new Date("2026-08-18T12:00:00.000Z")
    const scopedState = { ...state, generatedAt: "2026-08-10T12:00:00.000Z" }
    const records = [
      athleteRecord("same-day", 5000, "2026-08-10", now),
      athleteRecord("eligible", 5000, "2026-08-11", now),
      athleteRecord("wrong-event", 1500, "2026-08-11", now),
    ]
    render(<PlanAdaptationFlow state={scopedState} onLoadRecords={() => records} />)

    await openAdaptation(user)
    await user.click(screen.getByRole("button", { name: /최근 기록이 좋아졌어요/u }))

    expect(screen.getByRole("button", { name: /5000m.*2026-08-11/u })).toBeVisible()
    expect(screen.queryByText("2026-08-10 달성", { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText("1500m", { exact: false })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /5000m.*2026-08-11/u }))
    expect(screen.getByRole("heading", { name: "현재 몸 상태를 확인해 주세요" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByRole("heading", { name: "다음 계획의 기준을 선택해 주세요" })).toBeVisible()
  })

  it("reviews only changed sessions and accepts a SELF proposal without a second schedule", async () => {
    const user = userEvent.setup()
    const { state } = await createBoundActivePlan()
    render(<PlanAdaptationFlow state={state} />)

    await openAdaptation(user)
    await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }))

    const changedSection = (await screen.findByRole("heading", { name: "바뀌는 것" })).parentElement
    if (changedSection === null) throw new Error("Changed-session section missing")
    expect(within(changedSection).getAllByRole("listitem")).toHaveLength(3)
    expect(within(changedSection).getByText(/DAY 1 오전 · 기초 지구력 달리기/u)).toBeVisible()
    expect(within(changedSection).getByText(/DAY 5 오전 · 기초 지구력 달리기/u)).toBeVisible()
    expect(within(changedSection).getByText(/DAY 7 오전 · 기초 지구력 달리기/u)).toBeVisible()
    expect(within(changedSection).queryByText(/DAY 9 오전 · 반복 인터벌 · VO2 훈련/u)).not.toBeInTheDocument()
    const metadataTokens = [...changedSection.querySelectorAll(".plan-adaptation__metadata-token")]
      .map((token) => token.textContent)
    expect(metadataTokens).toContain("35~35분")
    expect(metadataTokens).toContain("기초 지구력 · BASE")
    const unchangedSection = screen.getByRole("heading", { name: "그대로인 것" }).parentElement
    if (unchangedSection === null) throw new Error("Unchanged-session section missing")
    expect(within(unchangedSection).getByText(/훈련 날짜와 세션 역할, 선택한 훈련 의도/u)).toBeVisible()
    expect(screen.getByRole("heading", { name: "이유와 기록 출처" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "불확실한 점" })).toBeVisible()
    expect(screen.queryByRole("list", { name: "날짜별 계획 미리보기" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "이 다음 계획 선택하기" }))
    expect(await screen.findByRole("status")).toHaveTextContent("현재 활성 계획과 진행 기록은 바뀌지 않았습니다")
  })

  it("keeps coach-required context read-only until an authenticated coach connection exists", async () => {
    const user = userEvent.setup()
    const { state } = await createBoundActivePlan()
    render(
      <PlanAdaptationFlow
        state={state}
        onPrepare={async () => ({ kind: "unavailable", code: "COACH_CONNECTION_REQUIRED" })}
      />,
    )

    await openAdaptation(user)
    await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }))

    expect(await screen.findByRole("status")).toHaveTextContent("인증된 지도자 연결이 없어")
    expect(screen.queryByRole("button", { name: "이 다음 계획 선택하기" })).not.toBeInTheDocument()
  })

  it("uses real D9 and active-plan hold results without blaming the athlete", async () => {
    const user = userEvent.setup()
    const { state } = await createBoundActivePlan()
    const firstSession = state.activePlan.sessions[0]
    if (firstSession === undefined) throw new Error("Expected an active session")
    const heldState: PlanBetaState = {
      ...state,
      progress: [{
        sessionDay: firstSession.day,
        sessionSlot: firstSession.slot,
        state: "PAIN_CHECKIN",
      }],
    }
    const firstRender = render(<PlanAdaptationFlow state={state} />)

    await openAdaptation(user)
    await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
    await user.click(screen.getByRole("button", { name: /통증·부상·몸 이상이 있거나 잘 모르겠어요/u }))

    expect(await screen.findByRole("status")).toHaveTextContent("현재 안전 상태를 먼저 확인해야 해서")
    firstRender.unmount()
    render(<PlanAdaptationFlow state={heldState} />)
    await openAdaptation(user)
    await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    await user.click(screen.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }))

    expect(await screen.findByRole("status")).toHaveTextContent("안전 상태를 다시 확인해야 해서")
    expect(screen.queryByRole("button", { name: "이 다음 계획 선택하기" })).not.toBeInTheDocument()
  })

  it("ignores an old pending envelope when a later frame reuses the candidate ID", async () => {
    const user = userEvent.setup()
    const fixture = await createBoundActivePlan()
    const stateA = { ...fixture.state, generatedAt: "2026-08-01T00:00:00.000Z" }
    expect(savePlanBetaState(stateA)).toEqual({ ok: true })
    const firstRender = render(<PlanAdaptationFlow state={stateA} />)

    await openAdaptation(user)
    await chooseAndAcceptReduction(user)
    expect(await screen.findByRole("status")).toHaveTextContent("현재 활성 계획과 진행 기록은 바뀌지 않았습니다")
    firstRender.unmount()

    const sameFrameReload = render(<PlanAdaptationFlow state={stateA} />)
    await openAdaptation(user)
    expect(await screen.findByRole("status")).toHaveTextContent("다음 주기에 사용할 보수적인 계획")
    sameFrameReload.unmount()

    const laterFrame = { ...stateA, generatedAt: "2026-08-02T00:00:00.000Z" }
    expect(laterFrame.activePlan.candidateId).toBe(stateA.activePlan.candidateId)
    expect(savePlanBetaState(laterFrame)).toEqual({ ok: true })
    const activeBytes = window.localStorage.getItem("trainoracle.plan-beta.v1")
    const laterRender = render(<PlanAdaptationFlow state={laterFrame} />)

    await openAdaptation(user)
    expect(screen.getByRole("heading", { name: "조정 이유를 선택해 주세요" })).toBeVisible()
    expect(screen.queryByText("다음 주기에 사용할 보수적인 계획")).not.toBeInTheDocument()
    await chooseAndAcceptReduction(user)
    expect(await screen.findByRole("status")).toHaveTextContent("현재 활성 계획과 진행 기록은 바뀌지 않았습니다")
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(activeBytes)
    laterRender.unmount()

    render(<PlanAdaptationFlow state={laterFrame} />)
    await openAdaptation(user)
    expect(await screen.findByRole("status")).toHaveTextContent("다음 주기에 사용할 보수적인 계획")
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(activeBytes)
  })
})

async function openAdaptation(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const action = screen.getByRole("button", { name: "다음 계획 조정하기" })
  await waitFor(() => expect(action).toBeEnabled())
  await user.click(action)
}

async function chooseAndAcceptReduction(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }))
  await user.click(await screen.findByRole("button", { name: "이 다음 계획 선택하기" }))
}

async function createBoundActivePlan(): Promise<{ readonly state: PlanBetaState }> {
  const now = new Date()
  const anchor = athleteRecord("00000000-0000-4000-8000-000000000010", 5000, "2026-08-01", now)
  saveAthleteRecord(anchor, now)
  const generated = generatePlanFromDraft({
    eventGroup: "FIVE_K",
    eventDistanceM: 5000,
    competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED",
    availableDayCount: 5,
    requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING",
    selectedDetailedTemplateRef: TEMPLATE_5000,
  }, "NO_KNOWN_RISK", { selectedRecordId: anchor.id })
  if (generated.kind !== "generated") throw new Error(`Expected generated plan, got ${generated.kind}`)
  const saved = await saveSelectedPlanCandidate(
    { candidateId: generated.generated.candidates[0].candidateId, startDate: "2026-08-18" },
    generated.generated,
    generated.gate,
    generated.intake,
    generated.athleteEvidence,
  )
  if (saved.kind !== "saved") throw new Error(`Expected saved plan, got ${saved.code}`)
  return { state: saved.state }
}

function athleteRecord(
  id: string,
  eventDistanceM: number,
  achievedOn: string,
  now: Date,
): AthleteRecord {
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "PERSONAL_BEST",
    eventDistanceM,
    performanceSeconds: eventDistanceM === 5000 ? 1_020 : 260,
    achievedOn,
    seasonId: null,
  }, now)
  if (record === null) throw new Error(`Invalid athlete record fixture: ${id}`)
  return record
}
