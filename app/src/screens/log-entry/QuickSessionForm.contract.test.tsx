import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { loadAnalysisEntries, loadEntries } from "../../domain/journal-store"
import { QuickSessionForm } from "./QuickSessionForm"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { collectPlanJournalEvidence } from "../../domain/plan-journal-evidence"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { savePlanBetaState, loadVersionedPlanBetaState } from "../../domain/plan-beta-store"
import { AppShellFrame, type ShellToastState } from "../../components/AppShellFrame"
import { createSavedFactReceipt } from "../../domain/save-receipt"

function finishPerformedSession(rpe = 6): void {
  fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
  fireEvent.click(screen.getByRole("button", { name: "오후" }))
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`힘든 정도 ${rpe}/10,`) }))
  fireEvent.click(screen.getByRole("button", { name: "없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
}

describe("quick session journal contract", () => {
  it("returns a single time or effort edit straight to review without repeating later answers", () => {
    render(<QuickSessionForm />)
    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오후" }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 6\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
    fireEvent.click(screen.getByRole("button", { name: "시간 오후" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    expect(screen.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "힘든 정도 6/10" })).toBeVisible()
    expect(screen.getByRole("button", { name: "몸 상태 불편한 곳 없음" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "힘든 정도 6/10" }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 4\/10,/ }))
    expect(screen.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
    expect(loadEntries()).toHaveLength(0)
  })
  it("uses one saved result with the shell reward retry and keeps the same record editable", async () => {
    const retry = vi.fn(), open = vi.fn(), done = vi.fn()
    function Fixture() {
      const [result, setResult] = React.useState<ShellToastState | null>(null)
      return <AppShellFrame scrollRegionRef={React.createRef()} tab="log" savedToast={result}
        onDismissToast={() => setResult(null)} onOpenTrends={vi.fn()} onTab={vi.fn()}
        onOpenSaved={open} onRetryReward={retry} hideTabBar>
        <QuickSessionForm onDone={done} onSaved={entry => setResult({ count: 1, phase: "enter",
          receipt: createSavedFactReceipt(entry), completionAlreadyShown: true, storageStatus: "CONFIRMED",
          rewardMessage: "포인트 확인이 필요해요.", rewardRetry: true })} />
      </AppShellFrame>
    }
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    expect(screen.queryByRole("button", { name: "포인트 다시 확인" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    await screen.findByRole("button", { name: "완료" })
    expect(document.querySelectorAll(".journal-save-result")).toHaveLength(1)
    expect(document.querySelector("[data-toast-priority]")).toBeNull()
    expect(screen.getAllByText("포인트 확인이 필요해요.")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(loadEntries()).toHaveLength(1)
    expect(done).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "기록 보기" }))
    expect(open).toHaveBeenCalledTimes(1)
    const originalId = loadEntries()[0]?.id
    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    expect(screen.getByRole("button", { name: "오늘은 쉬었어요" })).toHaveAttribute("aria-pressed", "true")
    expect(loadEntries()[0]?.id).toBe(originalId)
    expect(document.querySelector("[data-toast-priority]")).toBeNull()
  })

  it.each(["오늘 운동 완료", "시간 오후", "힘든 정도 6/10", "몸 상태 불편한 곳 없음"])(
    "dismisses the prior receipt when editing the saved summary: %s", async label => {
      const dismiss = vi.fn()
      function Fixture() {
        const [result, setResult] = React.useState<ShellToastState | null>(null)
        return <AppShellFrame scrollRegionRef={React.createRef()} tab="log" savedToast={result}
          onDismissToast={() => { dismiss(); setResult(null) }} onOpenTrends={vi.fn()} onTab={vi.fn()} hideTabBar>
          <QuickSessionForm onSaved={entry => setResult({ count: 1, phase: "enter",
            receipt: createSavedFactReceipt(entry), completionAlreadyShown: true, storageStatus: "CONFIRMED",
            rewardMessage: "포인트 확인이 필요해요." })} />
        </AppShellFrame>
      }
      render(<Fixture />)
      finishPerformedSession()
      await screen.findByRole("button", { name: "완료" })
      const original = loadEntries()[0]
      fireEvent.click(screen.getByRole("button", { name: label }))
      expect(dismiss).toHaveBeenCalledTimes(1)
      expect(document.querySelector("[data-toast-priority]")).toBeNull()
      expect(screen.queryByText("포인트 확인이 필요해요.")).not.toBeInTheDocument()
      expect(loadEntries()[0]).toEqual(original)
    })

  it("keeps the independent high-pain notice when the authoritative result also needs another review", async () => {
    function Fixture() {
      const [result, setResult] = React.useState<ShellToastState | null>(null)
      return <AppShellFrame scrollRegionRef={React.createRef()} tab="log" savedToast={result}
        onDismissToast={() => setResult(null)} onOpenTrends={vi.fn()} onTab={vi.fn()} hideTabBar>
        <QuickSessionForm onSaved={entry => setResult({ count: 1, phase: "enter", receipt: createSavedFactReceipt(entry),
          completionAlreadyShown: true, storageStatus: "CONFIRMED", reviewMessage: "합성 메모 검토가 필요해요." })} />
      </AppShellFrame>
    }
    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /^힘든 정도 6\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "있어요" }))
    for (let level = 0; level < 4; level++) fireEvent.click(screen.getByRole("button", { name: /오른 무릎, 통증/ }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    await screen.findByRole("button", { name: "완료" })
    expect(screen.getByRole("alert")).toHaveTextContent("합성 메모 검토가 필요해요.")
    expect(screen.getByText(/높은 통증은 사람이 꼭 확인해야 하는 기록이에요/)).toBeVisible()
    expect(loadEntries()[0]).toMatchObject({ painParts: { rKnee: 4 } })
    expect(document.querySelector("[data-toast-priority]")).toBeNull()
  })

  it("announces confirmed persistence before Done and never on an unsaved answer", async () => {
    const saved = vi.fn(), done = vi.fn()
    render(<QuickSessionForm onSaved={saved} onDone={done} />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    expect(saved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    await screen.findByRole("button", { name: "완료" })
    expect(saved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ activityOutcome: "RESTED" }), undefined, undefined)
    expect(done).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "완료" }))
    expect(saved).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])("marks the plan only with pre-save opt-in (%s), preserving missing actual quantities", async optedIn => {
    const state = stateFixture()
    expect(savePlanBetaState(state).ok).toBe(true)
    const link = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, new Date().toISOString())!
    const locks = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}),
    } })
    try {
      render(<QuickSessionForm plannedSessionLink={link.link} targetDate={link.date} />)
      fireEvent.click(screen.getByRole("button", { name: "계획대로 마쳤어요" }))
      fireEvent.click(screen.getByRole("button", { name: "오전" }))
      fireEvent.click(screen.getByRole("button", { name: /^힘든 정도 6\/10,/ }))
      fireEvent.click(screen.getByRole("button", { name: "없어요" }))
      const confirm = screen.getByRole("checkbox", { name: "계획에도 완료 표시 남기기" })
      expect(confirm).not.toBeChecked()
      if (optedIn) fireEvent.click(confirm)
      fireEvent.click(screen.getByRole("button", { name: optedIn ? "저장하고 계획에 완료 표시" : "이대로 저장" }))
      await waitFor(() => expect(screen.getByRole("button", { name: "완료" })).toBeVisible())
      expect(loadEntries()).toHaveLength(1)
      expect(loadEntries()[0]).toMatchObject({ distanceKm: "", durationMin: "", avgPace: "", rpe: 6 })
      expect(loadVersionedPlanBetaState()?.progress).toEqual(optedIn ? [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] : [])
      expect(screen.getByText("내용 추가·수정").closest("details")).not.toHaveAttribute("open")
    } finally {
      if (locks) Object.defineProperty(navigator, "locks", locks)
      else Reflect.deleteProperty(navigator, "locks")
    }
  })

  it("withdraws pre-save plan consent when the reported result changes", () => {
    const state = stateFixture()
    savePlanBetaState(state)
    const link = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, new Date().toISOString())!
    render(<QuickSessionForm plannedSessionLink={link.link} targetDate={link.date} />)
    fireEvent.click(screen.getByRole("button", { name: "계획 대신 쉬었어요" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "계획에도 휴식 표시 남기기" }))
    fireEvent.click(screen.getByRole("button", { name: /휴식으로 변경/ }))
    fireEvent.click(screen.getByRole("button", { name: "계획한 훈련을 건너뛰었어요" }))
    expect(screen.getByRole("checkbox", { name: "계획에도 건너뜀 표시 남기기" })).not.toBeChecked()
    expect(loadEntries()).toEqual([])
    expect(loadVersionedPlanBetaState()?.progress).toEqual([])
  })

  it("keeps the successful journal when the opted-in plan write fails", async () => {
    const state = stateFixture()
    savePlanBetaState(state)
    const link = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, new Date().toISOString())!
    const locks = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}),
    } })
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "trainoracle.plan-beta.v1") throw new DOMException("quota", "QuotaExceededError")
      original.call(this, key, value)
    })
    try {
      render(<QuickSessionForm plannedSessionLink={link.link} targetDate={link.date} />)
      fireEvent.click(screen.getByRole("button", { name: "계획 대신 쉬었어요" }))
      fireEvent.click(screen.getByRole("checkbox", { name: "계획에도 휴식 표시 남기기" }))
      fireEvent.click(screen.getByRole("button", { name: "저장하고 계획에 휴식 표시" }))
      await waitFor(() => expect(screen.getByText(/일지는 저장돼 있어요/)).toBeVisible())
      expect(screen.getByRole("button", { name: "이 결과를 계획에도 반영" })).toBeVisible()
      expect(loadEntries()).toHaveLength(1)
      expect(loadEntries()[0]).toMatchObject({ activityOutcome: "RESTED", rpe: 0 })
      expect(loadVersionedPlanBetaState()?.progress).toEqual([])
    } finally {
      if (locks) Object.defineProperty(navigator, "locks", locks)
      else Reflect.deleteProperty(navigator, "locks")
    }
  })

  it("shows one active question and keeps answers editable when moving back", () => {
    const onBack = vi.fn()
    render(<QuickSessionForm onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    expect(screen.getByRole("heading", { name: "언제 했나요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "운동을 마쳤어요" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "오후" }))
    fireEvent.click(screen.getByRole("button", { name: /^힘든 정도 7\/10,/ }))
    expect(screen.getByRole("heading", { name: "운동 후 불편하거나 아픈 곳이 있나요?" })).toBeVisible()
    expect(screen.queryByRole("group", { name: "힘든 정도 1부터 10까지" })).toBeNull()
    expect(screen.getByRole("button", { name: /운동 완료/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /오후/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /힘든 정도 7\/10/ })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(screen.getByRole("button", { name: /^힘든 정도 7\/10,/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-pressed", "true")
    expect(onBack).not.toHaveBeenCalled()
    expect(loadEntries()).toEqual([])
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: "모르겠어요 · 비워 둘게요" }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(loadEntries()[0]).toMatchObject({ activitySlot: "AM", rpe: 0, painCheckStatus: "NO_SIGNAL_REPORTED", fieldProvenance: { rpe: { provenance: "MISSING" } } })
  })

  it("uses one focused task heading and shows the saved answers below the current question", () => {
    render(<QuickSessionForm />)

    const firstQuestion = screen.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })
    expect(firstQuestion.tagName).toBe("H2")
    expect(screen.getAllByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))

    const nextQuestion = screen.getByRole("heading", { name: "언제 했나요?" })
    expect(nextQuestion.tagName).toBe("H2")
    expect(screen.getAllByRole("heading", { name: "언제 했나요?" })).toHaveLength(1)
    expect(screen.getByRole("button", { name: /운동 완료/ })).toBeVisible()
    expect(screen.queryByRole("group", { name: "힘든 정도 1부터 10까지" })).toBeNull()
  })
  it("accepts a note and two exercises first without saving or bypassing the activity and body check", () => {
    render(<QuickSessionForm />)
    const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))
    const additions = screen.getByText("메모·운동 내용 먼저 쓰기").closest("details")!
    additions.open = true
    click("메모 먼저 쓰기")
    fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
    fireEvent.change(screen.getByLabelText("일지 내용"), { target: { value: "합성 메모 먼저" } })
    click("운동 내용"); click("운동 추가"); click("반복 달리기"); click("내용 반영")
    click("운동 추가"); click("근력 운동"); click("내용 반영")
    click("운동 결과 선택으로")
    expect(screen.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "이대로 저장" })).toBeNull()
    expect(loadEntries()).toEqual([])
    click("운동을 마쳤어요"); click("오전")
    click("모르겠어요 · 비워 둘게요")
    expect(screen.getByRole("heading", { name: "운동 후 불편하거나 아픈 곳이 있나요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "이대로 저장" })).toBeNull()
    click("없어요"); click("글 수정")
    expect(screen.getByLabelText("일지 내용")).toHaveValue("합성 메모 먼저")
    click("내용 반영"); click("이대로 저장")
    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toMatchObject({ memo: "합성 메모 먼저", rpe: 0,
      painCheckStatus: "NO_SIGNAL_REPORTED", exerciseLog: { components: [
        { kind: "INTERVALS", rows: [] }, { kind: "STRENGTH", rows: [] },
      ] }, fieldProvenance: { rpe: { provenance: "MISSING" } } })
  })

  it("retains optional qualitative changes without inventing performed quantities", () => {
    const state = stateFixture()
    const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, new Date().toISOString())!
    render(<QuickSessionForm plannedSessionLink={draft.link} targetDate={draft.date} />)
    fireEvent.click(screen.getByRole("button", { name: "일부만 했거나 내용을 바꿨어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /^힘든 정도 8\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
    fireEvent.click(screen.getByRole("button", { name: "횟수를 줄였어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    const entry = loadEntries()[0]
    expect(entry).toMatchObject({ activityOutcome: "PARTIAL", planExecutionChange: "FEWER_REPETITIONS",
      distanceKm: "", durationMin: "", fieldProvenance: { planExecutionChange: { provenance: "EXPLICIT" } } })
    expect(screen.queryByRole("button", { name: "이 결과를 계획에도 반영" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "계획 대신 쉬었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(loadEntries()[0]).not.toHaveProperty("planExecutionChange")
  })

  it("protects unsaved guest input without writing it and leaves freely after save", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const navigate = vi.fn()
    render(<QuickSessionForm />)
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "글 추가" }))
    fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
    fireEvent.change(screen.getByLabelText("일지 내용"), { target: { value: "합성 작성 내용" } })
    fireEvent.click(screen.getByRole("button", { name: "내용 반영" }))
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    expect(loadEntries()).toEqual([])
    expect(JSON.stringify(localStorage)).not.toContain("합성 작성 내용")
    fireEvent.click(screen.getByRole("button", { name: "글 수정" }))
    expect(screen.getByLabelText("일지 내용")).toHaveValue("합성 작성 내용")
    fireEvent.click(screen.getByRole("button", { name: "내용 반영" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(loadEntries()).toHaveLength(1)
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it("names private storage setup before the last save rather than promising a saved note", () => {
    sessionStorage.clear()
    render(<QuickSessionForm />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "글 추가" }))
    fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
    expect(screen.getByText(/처음 한 번, 비밀 메모/)).toBeVisible()
    fireEvent.change(screen.getByLabelText("일지 내용"), { target: { value: "합성 비밀 글" } })
    fireEvent.click(screen.getByRole("button", { name: "내용 반영" }))
    expect(screen.getByRole("button", { name: "비밀 메모 보관 준비" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "이대로 저장" })).toBeNull()
    expect(loadEntries()).toEqual([])
  })
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("does not save a rest choice before the final confirmation", () => {
    render(<QuickSessionForm />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    expect(loadEntries()).toHaveLength(0)
    expect(screen.getByRole("button", { name: "글 추가" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(loadEntries()).toHaveLength(1)
  })

  it("adds two different exercises and a note before saving one record", () => {
    render(<QuickSessionForm />)
    const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))
    click("운동을 마쳤어요"); click("오전")
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 5\/10,/ }))
    click("없어요")
    expect(loadEntries()).toHaveLength(0)
    click("운동 추가·수정"); click("운동 추가"); click("반복 달리기"); click("거리·시간·횟수 적기")
    fireEvent.change(screen.getByLabelText("1번 거리 (m)"), { target: { value: "400" } })
    fireEvent.change(screen.getByLabelText("1번 반복 횟수"), { target: { value: "10" } })
    click("내용 반영"); click("운동 추가"); click("근력 운동"); click("내용 반영")
    click("기록 요약으로"); click("글 추가")
    fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
    fireEvent.change(screen.getByLabelText("일지 내용"), { target: { value: "트랙에서 반복 달리기 후 근력 운동" } })
    click("내용 반영")
    expect(loadEntries()).toHaveLength(0)
    click("이대로 저장")
    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toMatchObject({ memo: "트랙에서 반복 달리기 후 근력 운동", exerciseLog: { components: [
      { kind: "INTERVALS", rows: [{ distanceM: 400, repetitions: 10 }] }, { kind: "STRENGTH", rows: [] },
    ] }, distanceKm: "", durationMin: "", rpe: 5 })
  })

  it("stores an exact one-tap RPE that is immediately eligible for descriptive analysis", () => {
    const onDone = vi.fn()
    render(<QuickSessionForm onDone={onDone} />)

    finishPerformedSession(6)

    expect(screen.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
    const [entry] = loadEntries()
    expect(entry).toMatchObject({
      kind: "post-session",
      captureDepth: "QUICK",
      activityOutcome: "COMPLETED",
      activitySlot: "PM",
      rpe: 6,
      painCheckStatus: "NO_SIGNAL_REPORTED",
      objectiveDataState: "WAITING",
      planExecutionRelation: "NOT_APPLICABLE",
      fieldProvenance: {
        rpe: { provenance: "EXPLICIT" },
        painCheckStatus: { provenance: "EXPLICIT" },
        distanceKm: { provenance: "MISSING" },
        plannedSessionLink: { provenance: "MISSING" },
          planExecutionRelation: {
            provenance: "DERIVED",
            derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
      },
    })
    expect(entry?.kind === "post-session" ? entry.rpeBand : undefined).toBeUndefined()
    expect(loadAnalysisEntries()).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "완료" }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: entry?.id }))
  })

  it("finishes rest without asking for a time, RPE, or objective data", () => {
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    const [entry] = loadEntries()
    expect(entry).toMatchObject({
      activityOutcome: "RESTED",
      objectiveDataState: "NONE",
      rpe: 0,
    })
    expect(entry?.kind === "post-session" ? entry.activitySlot : undefined).toBeUndefined()
    expect(entry?.kind === "post-session" ? entry.rpeBand : undefined).toBeUndefined()
  })

  it("keeps 모르겠어요 missing instead of inventing an effort value", () => {
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "가볍게 움직였어요" }))
    fireEvent.click(screen.getByRole("button", { name: "시간 미지정" }))
    fireEvent.click(screen.getByRole("button", { name: "모르겠어요 · 비워 둘게요" }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(loadEntries()[0]).toMatchObject({
      activitySlot: "UNSPECIFIED",
      rpe: 0,
      fieldProvenance: { rpe: { provenance: "MISSING" } },
    })
  })

  it("hands the same saved id to detailed editing", () => {
    const onContinueDetailed = vi.fn()
    render(<QuickSessionForm onContinueDetailed={onContinueDetailed} />)

    finishPerformedSession(4)
    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "일지 더 쓰기" }))

    const [entry] = loadEntries()
    expect(loadEntries()).toHaveLength(1)
    expect(onContinueDetailed).toHaveBeenCalledWith(expect.objectContaining({ id: entry?.id }))
  })

  it("allows a saved choice to be corrected without creating a duplicate", () => {
    render(<QuickSessionForm />)
    finishPerformedSession(6)
    const original = loadEntries()[0]

    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "하던 운동을 일부만 했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "시간 오후" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: "힘든 정도 6/10" }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 7\/10,/ }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toMatchObject({
      id: original?.id,
      activityOutcome: "PARTIAL",
      activitySlot: "AM",
      rpe: 7,
    })
  })

  it("removes performed-only facts when a saved activity is corrected to rest", () => {
    render(<QuickSessionForm />)
    finishPerformedSession(6)

    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    const [entry] = loadEntries()
    expect(entry).toMatchObject({ activityOutcome: "RESTED", objectiveDataState: "NONE", rpe: 0 })
    if (entry?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(entry.activitySlot).toBeUndefined()
    expect(entry.painCheckStatus).toBeUndefined()
    expect(entry.painParts).toBeUndefined()
    expect(entry.fieldProvenance?.activitySlot).toBeUndefined()
    expect(entry.fieldProvenance?.painCheckStatus).toBeUndefined()
    expect(entry.fieldProvenance?.painParts).toBeUndefined()
  })

  it("requires a structured body area when the athlete reports discomfort", () => {
    render(<QuickSessionForm />)
    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 5\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "있어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))

    expect(screen.getByRole("alert")).toHaveTextContent("하나 이상")
    expect(loadEntries()).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: /오른 무릎, 통증 없음/ }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(loadEntries()[0]).toMatchObject({
      painCheckStatus: "SIGNAL_REPORTED",
      painParts: { rKnee: 1 },
    })
  })

  it("shows no success state when local storage rejects the write", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(screen.queryByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요")
    setItem.mockRestore()
  })

  it("names the selected future date in the saved receipt", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T12:00:00"))
    render(<QuickSessionForm targetDate="2026-09-08" />)

    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(screen.getByRole("heading", { name: "9월 8일 기록을 남겼어요." })).toBeVisible()
  })

  it("records a completed linked session in the other AM/PM slot as modified", () => {
    const plan = stateFixture()
    const session = plan.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(plan, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")
    const otherSlot = draft.link.sessionSlot === "AM" ? "오후" : "오전"

    render(<QuickSessionForm targetDate={draft.date} plannedSessionLink={draft.link} />)
    fireEvent.click(screen.getByRole("button", { name: "계획대로 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: otherSlot }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 6\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(loadEntries()[0]).toMatchObject({ planExecutionRelation: "MODIFIED" })
  })

  it("keeps an unspecified linked AM/PM slot unknown rather than changed", () => {
    const plan = stateFixture()
    const session = plan.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(plan, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")

    render(<QuickSessionForm targetDate={draft.date} plannedSessionLink={draft.link} />)
    fireEvent.click(screen.getByRole("button", { name: "계획대로 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "시간 미지정" }))
    fireEvent.click(screen.getByRole("button", { name: /힘든 정도 6\/10,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))

    expect(loadEntries()[0]).toMatchObject({
      activitySlot: "UNSPECIFIED",
      planExecutionRelation: "UNKNOWN",
    })
    expect(collectPlanJournalEvidence(loadEntries(), plan).rows[0]?.comparison).not.toBe("CHANGED_SESSION")
  })
})
