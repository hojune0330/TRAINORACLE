import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlanRebuildEditor } from "./ActivePlanRebuildEditor"

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  select: vi.fn(),
  replace: vi.fn(),
  anchorsCurrent: vi.fn(),
  safety: vi.fn(),
  detailedAuthority: vi.fn(),
}))

vi.mock("../../domain/plan-beta-flow", () => ({
  generateReplacementPlanFromDraft: mocks.generate,
  selectPlanForActivation: mocks.select,
  evaluatePlanSafety: mocks.safety,
}))
vi.mock("../../domain/active-plan-edit-store", () => ({ replaceActivePlanWithDraft: mocks.replace }))
vi.mock("../../domain/plan-anchor-reconfirmation", () => ({ planAnchorsStillCurrent: mocks.anchorsCurrent }))
vi.mock("../../domain/plan-session-schema", () => ({ recheckStoredDetailedPrescriptionAuthority: mocks.detailedAuthority }))
vi.mock("../../domain/journal-store", () => ({
  loadEntriesForPlanSafety: () => ({ status: "complete", entries: [] }),
  todayISO: () => "2026-10-01",
}))
vi.mock("../../domain/active-plan-edit", () => ({ activePlanEditEvidenceFingerprint: () => "evidence-fixture" }))
vi.mock("../../domain/account/local-journal-ownership", () => ({ onLocalJournalScopeChange: () => () => undefined }))
vi.mock("../../domain/plan-beta-schema", () => ({ planBetaStateV3Schema: { safeParse: (data: unknown) => ({ success: true, data }) } }))
vi.mock("./usePlanDraftNavigationGuard", () => ({ usePlanDraftNavigationGuard: () => undefined }))
vi.mock("./PlanRefinePanel", () => ({
  PlanRefinePanel: ({ onRefine }: { onRefine: (step: "race-date" | "template") => void }) => <>
    <button type="button" onClick={() => onRefine("race-date")}>대회 날짜 바꾸기</button>
    <button type="button" onClick={() => onRefine("template")}>안내 방식 바꾸기</button>
  </>,
}))
vi.mock("./PlanIntake", () => ({
  PlanIntake: ({ onRaceDate, onTemplate }: { onRaceDate: (date: string) => void; onTemplate: (template: null) => void }) => <>
    <button type="button" onClick={() => onRaceDate("2026-11-15")}>대회 날짜 선택</button>
    <button type="button" onClick={() => onTemplate(null)}>시간·힘든 정도로 받기</button>
  </>,
}))
vi.mock("./PlanSchedulePreview", () => ({ PlanSchedulePreview: () => <div>일정 미리보기</div> }))
vi.mock("./plan-template-options", () => ({ resolveDetailedPlanTemplateOptions: () => [] }))
vi.mock("./plan-intake-navigation", () => ({ eventGroupForDistance: () => "RUNNING" }))
vi.mock("./plan-feedback", () => ({ planErrorMessage: () => "계획을 만들지 못했어요." }))
vi.mock("./labels", () => ({ candidateLabel: () => ({ title: "훈련 구성" }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.safety.mockReturnValue({ kind: "passed", gate: { kind: "passed" } })
  mocks.detailedAuthority.mockReturnValue({ kind: "permitted" })
  mocks.anchorsCurrent.mockReturnValue(true)
})

function fixture(): PlanBetaStateV3 {
  return stateFixture() as PlanBetaStateV3
}

function anchoredFixture(): PlanBetaStateV3 {
  const state = fixture()
  return {
    ...state,
    intake: { ...state.intake, selectedDetailedTemplateRef: { templateId: "V2-SEED-05", version: "1.0.0" } },
    activePlan: { ...state.activePlan, sessions: [{
      ...state.activePlan.sessions[0]!,
      prescription: { kind: "PACE_TARGET", selectedAnchor: { anchorId: "record-fixture" } },
    }, ...state.activePlan.sessions.slice(1)] },
  } as unknown as PlanBetaStateV3
}

describe("active plan rebuild editor", () => {
  it("keeps the active plan untouched when canceled before explicit apply", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const original = JSON.stringify(state)
    const onCancel = vi.fn()

    render(<ActivePlanRebuildEditor state={state} onCancel={onCancel} onApplied={vi.fn()} />)
    expect(screen.getByRole("region", { name: "새 계획 만들기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "취소" }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(JSON.stringify(state)).toBe(original)
  })

  it("blocks a stale source record anchor before generating a draft", async () => {
    const user = userEvent.setup()
    const anchoredState = anchoredFixture()
    mocks.detailedAuthority.mockReturnValue({ kind: "blocked" })
    const onManageRecords = vi.fn()

    render(<ActivePlanRebuildEditor state={anchoredState} onCancel={vi.fn()} onApplied={vi.fn()} onManageRecords={onManageRecords} />)
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요" }))
    await user.click(screen.getByRole("button", { name: "새 계획안 보기" }))

    expect(mocks.detailedAuthority).toHaveBeenCalledOnce()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("기준 기록")
    await user.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
    expect(onManageRecords).toHaveBeenCalledOnce()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("allows an explicit effort-based rebuild without reusing the stale source pace anchor", async () => {
    const user = userEvent.setup()
    const state = anchoredFixture(), original = JSON.stringify(state)
    mocks.detailedAuthority.mockReturnValue({ kind: "blocked" })
    mocks.generate.mockReturnValue({ kind: "generated", generated: { candidates: [{ candidateId: "rpe-draft",
      kind: "BALANCED", selectedEnergyIntent: "LT_INTENT", sessions: [] }] },
      intake: { ...state.intake, selectedDetailedTemplateRef: null }, prescriptionBinding: { kind: "fallback" } })
    render(<ActivePlanRebuildEditor state={state} onCancel={vi.fn()} onApplied={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "안내 방식 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "시간·힘든 정도로 받기" }))
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요" }))
    await user.click(screen.getByRole("button", { name: "새 계획안 보기" }))

    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ selectedDetailedTemplateRef: null }), "NO_KNOWN_RISK", undefined)
    expect(mocks.detailedAuthority).not.toHaveBeenCalled()
    expect(screen.getByText("일정 미리보기")).toBeVisible()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(JSON.stringify(state)).toBe(original)
  })

  it("requires a valid today-or-future start date before generation", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ActivePlanRebuildEditor state={fixture()} onCancel={onCancel} onApplied={vi.fn()} />)
    await user.clear(screen.getByLabelText("시작 날짜"))
    await user.type(screen.getByLabelText("시작 날짜"), "2026-09-30")
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요" }))
    await user.click(screen.getByRole("button", { name: "새 계획안 보기" }))

    expect(mocks.generate).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("오늘 또는 이후")
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("makes the unsupported race-date persistence boundary explicit and offers a no-date alternative", async () => {
    const user = userEvent.setup()
    mocks.anchorsCurrent.mockReturnValue(true)
    mocks.generate.mockReturnValue({ kind: "preview_only", code: "RACE_DATE_PERSISTENCE_NOT_AUTHORIZED" })

    render(<ActivePlanRebuildEditor state={fixture()} onCancel={vi.fn()} onApplied={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "대회 날짜 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "대회 날짜 선택" }))
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요" }))
    await user.click(screen.getByRole("button", { name: "새 계획안 보기" }))

    expect(mocks.generate).toHaveBeenCalledOnce()
    expect(screen.getByRole("status")).toHaveTextContent("미리보기까지만 지원")
    expect(screen.getByRole("button", { name: "대회 날짜 없이 만들기" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "이 새 계획으로 시작" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "대회 날짜 없이 만들기" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows a generated draft without replacing the active plan until explicit apply", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const original = JSON.stringify(state)
    const candidate = {
      candidateId: "candidate-fixture",
      kind: "BALANCED",
      selectedEnergyIntent: "GENERAL_FITNESS",
      sessions: [],
    }
    const nextState = { ...state, activePlan: { ...state.activePlan, candidateId: "replacement-plan" } } as PlanBetaStateV3
    mocks.generate.mockReturnValue({
      kind: "generated",
      generated: { candidates: [candidate] },
      gate: { kind: "passed" },
      intake: state.intake,
      athleteEvidence: {},
      prescriptionBinding: { kind: "bound" },
    })
    mocks.select.mockReturnValue({ kind: "selected", state: nextState })
    mocks.replace.mockResolvedValue({ kind: "applied", state: nextState })
    const onApplied = vi.fn()

    render(<ActivePlanRebuildEditor state={state} onCancel={vi.fn()} onApplied={onApplied} />)
    await user.clear(screen.getByLabelText("시작 날짜"))
    await user.type(screen.getByLabelText("시작 날짜"), "2026-10-02")
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요" }))
    await user.click(screen.getByRole("button", { name: "새 계획안 보기" }))

    expect(screen.getByText("일정 미리보기")).toBeVisible()
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2026-10-02" }), "NO_KNOWN_RISK", undefined)
    expect(JSON.stringify(state)).toBe(original)
    expect(mocks.replace).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "이 새 계획으로 시작" }))
    expect(mocks.replace).toHaveBeenCalledOnce()
    expect(mocks.select).toHaveBeenCalledWith(candidate.candidateId, expect.anything(), expect.anything(), expect.objectContaining({ startDate: "2026-10-02" }), expect.anything())
    expect(onApplied).toHaveBeenCalledWith(nextState)
  })
})
