import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { GoalTrainingProgram, GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import type { GoalTrainingProgramReadResult, StoredGoalTrainingProgram } from "../../domain/goal-training-program-store"
import { GoalTrainingProgramFlow } from "./GoalTrainingProgramFlow"

const mocks = vi.hoisted(() => ({
  createPreview: vi.fn(),
  durationReview: vi.fn(),
  generate: vi.fn(),
  projectFrames: vi.fn(),
  read: vi.fn(),
  subscribe: vi.fn(),
  storageStatus: vi.fn(),
  refresh: vi.fn(),
  accountSnapshot: vi.fn(),
  acceptRemote: vi.fn(),
  conflictBackup: vi.fn(),
  save: vi.fn(),
  apply: vi.fn(),
  archive: vi.fn(),
  exportBackup: vi.fn(),
  restore: vi.fn(),
  evaluateSafety: vi.fn(),
  owner: null as string | null,
  today: "2026-10-11",
}))

vi.mock("../../domain/goal-training-program", () => ({
  createGoalTrainingProgramPreview: mocks.createPreview,
  goalTrainingProgramDurationReview: mocks.durationReview,
  generateGoalTrainingProgram: mocks.generate,
  projectGoalTrainingProgramFrames: mocks.projectFrames,
}))
vi.mock("../../domain/goal-training-program-summary", () => ({
  summarizeGoalTrainingProgram: () => ({ frames: [] }),
}))
vi.mock("../../domain/goal-training-program-store", () => ({
  readGoalTrainingProgram: mocks.read,
  subscribeGoalTrainingProgramChanges: mocks.subscribe,
  goalTrainingProgramStorageStatus: mocks.storageStatus,
  refreshGoalTrainingProgram: mocks.refresh,
  goalTrainingProgramAccountSnapshot: mocks.accountSnapshot,
  acceptRemoteGoalTrainingProgram: mocks.acceptRemote,
  exportGoalTrainingProgramConflictJSON: mocks.conflictBackup,
  saveGoalTrainingProgram: mocks.save,
  applyGoalTrainingProgramCycle: mocks.apply,
  archiveGoalTrainingProgramCycle: mocks.archive,
  exportGoalTrainingProgramJSON: mocks.exportBackup,
  restoreGoalTrainingProgramJSON: mocks.restore,
}))
vi.mock("../../domain/plan-beta-flow", () => ({ evaluatePlanSafety: mocks.evaluateSafety }))
vi.mock("../../domain/journal-store", () => ({ todayISO: () => mocks.today }))
vi.mock("../../domain/account/local-account-scope", () => ({
  localAccountScopeSnapshot: () => mocks.owner,
  localAccountScopeIsCurrent: (owner: string | null) => owner === mocks.owner,
}))
vi.mock("../../domain/account/local-journal-ownership", () => ({ localJournalScopeGeneration: () => 1 }))
vi.mock("../../hooks/useTaskFlowBack", () => ({ useTaskFlowBack: () => undefined }))
vi.mock("./usePlanDraftNavigationGuard", () => ({ usePlanDraftNavigationGuard: () => undefined }))
vi.mock("./PlanSchedulePreview", () => ({ PlanSchedulePreview: () => null }))

const START = "2026-10-11"
const GATE = { kind: "PASSED" }

let currentDocument: StoredGoalTrainingProgram | null
let forcedRead: "normal" | "storage_error" | "missing"
let forcedStatus: "CURRENT" | "PAUSED" | null
let latestPreview: GoalTrainingProgramPreview

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function previewFor(input: Record<string, unknown>): GoalTrainingProgramPreview {
  const dateChoice = input.dateChoice as { kind: "START"; startDate: string } | { kind: "DEADLINE"; deadline: string }
  const startDate = dateChoice.kind === "START" ? dateChoice.startDate : shiftDate(dateChoice.deadline, -28)
  const deadline = dateChoice.kind === "DEADLINE" ? dateChoice.deadline : null
  return {
    kind: "GOAL_TRAINING_PROGRAM_PREVIEW",
    activationAllowed: false,
    safetyState: "NOT_CHECKED",
    goalMinutes: input.goalMinutes as 60 | 50 | 45 | 40 | 30,
    dateChoice,
    window: { startDate, endDate: shiftDate(startDate, 28), deadline, halfDays: [] },
    inputs: {
      experienceBand: input.experienceBand as "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED",
      availableDayCount: input.availableDayCount as 3 | 4 | 5 | 6,
      trainingTimePreference: input.trainingTimePreference as "MORNING" | "EVENING" | "VARIES",
      candidateKind: "BALANCED",
      trainingFocus: "MIXED_INTENT",
      goalPaceConfirmed: input.goalPaceConfirmed === true,
    },
    generatedAt: input.generatedAt as string,
    frames: [],
    days: [],
  } as unknown as GoalTrainingProgramPreview
}

function programFor(preview: GoalTrainingProgramPreview): GoalTrainingProgram {
  return {
    schemaVersion: 1,
    programId: "goal-program-fixture",
    source: { id: "fixture", version: "1.0.0", fingerprint: "fixture" },
    goalMinutes: preview.goalMinutes,
    dateChoice: preview.dateChoice,
    window: preview.window,
    inputs: preview.inputs,
    generatedAt: preview.generatedAt,
    frames: ([1, 2, 3] as const).map((cycle, index) => ({
      cycle,
      halfDayOffset: (index * 19) as 0 | 19 | 38,
      formation: {} as never,
      plan: { intake: { startDate: shiftDate(preview.window.startDate, index * 9) } } as never,
    })),
    days: preview.days,
  } as unknown as GoalTrainingProgram
}

function loadedRead(status: "NOT_STARTED" | "CURRENT" | "PAUSED" = "NOT_STARTED"): GoalTrainingProgramReadResult {
  if (!currentDocument) return { kind: "missing" }
  return { kind: "loaded", document: currentDocument, currentPlan: null, currentCycleStatus: status }
}

function makeStoredDocument(program: GoalTrainingProgram): StoredGoalTrainingProgram {
  return {
    version: 1,
    revision: 1,
    program,
    application: null,
    cycles: ([1, 2, 3] as const).map(cycle => ({
      cycle,
      status: "PENDING",
      latestPlan: null,
      lineage: [],
    })) as unknown as StoredGoalTrainingProgram["cycles"],
  }
}

function renderFlow(onClose = vi.fn()) {
  return render(<React.StrictMode><GoalTrainingProgramFlow onClose={onClose} onOpenActive={vi.fn()} /></React.StrictMode>)
}

function expiredPendingDateReview(hasConfirmed = false) {
  mocks.owner = "synthetic-account"; mocks.today = "2026-10-12"
  mocks.storageStatus.mockReturnValue("PENDING")
  if (hasConfirmed) currentDocument = makeStoredDocument({ ...programFor(latestPreview), programId: "confirmed-original" })
  const pendingDocument = makeStoredDocument({ ...programFor(latestPreview), programId: "expired-pending-original" })
  pendingDocument.revision = hasConfirmed ? 2 : 0
  const review = { ownerId: mocks.owner, sessionGeneration: 1, status: "PENDING" as const, revision: hasConfirmed ? 1 : 0,
    sequence: 2, historyLoaded: true, document: currentDocument, history: { version: 1 as const, entries: [] },
    pendingDocument, remoteRevision: null, goalStartDateReviewRequired: true as const }
  mocks.accountSnapshot.mockReturnValue(review)
  return review
}

async function chooseNewPendingDate(user: ReturnType<typeof userEvent.setup>, date = "2026-10-18") {
  await user.click(screen.getByRole("button", { name: "날짜를 다시 골라 보관하기" }))
  expect(screen.getByLabelText("시작일")).toHaveValue(START)
  fireEvent.change(screen.getByLabelText("시작일"), { target: { value: date } })
  await user.click(screen.getByRole("button", { name: "다음" }))
  await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/u }))
  await user.click(screen.getByRole("button", { name: /시간 기준으로 훈련/u }))
}

async function chooseGoalDateAndExperience(user: ReturnType<typeof userEvent.setup>, goal = 45, date = "2026-10-18") {
  await chooseGoalDate(user, goal, date)
  await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/u }))
  await user.click(screen.getByRole("button", { name: /시간 기준으로 훈련/u }))
}

async function chooseGoalDate(user: ReturnType<typeof userEvent.setup>, goal = 45, date = "2026-10-18") {
  await user.click(screen.getByRole("button", { name: `${goal}분 목표` }))
  await user.click(screen.getByRole("button", { name: "시작일 선택" }))
  fireEvent.change(screen.getByLabelText("시작일"), { target: { value: date } })
  await user.click(screen.getByRole("button", { name: "다음" }))
}

beforeEach(() => {
  currentDocument = null
  forcedRead = "normal"
  forcedStatus = null
  latestPreview = previewFor({
    goalMinutes: 45,
    dateChoice: { kind: "START", startDate: START },
    generatedAt: "2026-10-11T00:00:00.000Z",
    experienceBand: "EXPERIENCED",
    availableDayCount: 3,
    trainingTimePreference: "VARIES",
    goalPaceConfirmed: false,
  })
  mocks.owner = null
  mocks.today = START
  mocks.storageStatus.mockReturnValue("DEVICE")
  mocks.refresh.mockResolvedValue(true)
  mocks.accountSnapshot.mockReturnValue(null)
  mocks.acceptRemote.mockResolvedValue(false)
  mocks.conflictBackup.mockRejectedValue(new Error("Not available"))
  mocks.read.mockImplementation(() => {
    if (forcedRead === "storage_error") return { kind: "storage_error" }
    if (forcedRead === "missing") return { kind: "missing" }
    return loadedRead(forcedStatus ?? (currentDocument?.application ? "CURRENT" : "NOT_STARTED"))
  })
  mocks.subscribe.mockReturnValue(() => undefined)
  mocks.createPreview.mockImplementation((input: Record<string, unknown>) => {
    latestPreview = previewFor(input)
    return { kind: "preview", preview: latestPreview }
  })
  mocks.durationReview.mockReturnValue({ required: false, maximumSeconds: null, longerWorkoutCount: 0 })
  mocks.generate.mockImplementation(() => ({ kind: "ready", program: programFor(latestPreview) }))
  mocks.projectFrames.mockImplementation((program: GoalTrainingProgram) => ({ kind: "ready", days: program.days }))
  mocks.evaluateSafety.mockReturnValue({ kind: "passed", gate: GATE })
  mocks.save.mockImplementation(async (program: GoalTrainingProgram) => {
    currentDocument = makeStoredDocument(program)
    return { kind: "saved", document: currentDocument }
  })
  mocks.apply.mockImplementation(async ({ cycle }: { cycle: 1 | 2 | 3 }) => {
    if (currentDocument) {
      currentDocument.cycles[cycle - 1]!.status = "CURRENT"
      currentDocument.application = { appliedAt: "2026-10-11T00:00:00.000Z", currentCycleIndex: cycle }
    }
    forcedStatus = "CURRENT"
    return { kind: "applied" }
  })
  mocks.archive.mockReset()
  mocks.exportBackup.mockReset()
  mocks.restore.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  currentDocument = null
  forcedRead = "normal"
  forcedStatus = null
  mocks.owner = null
})

describe("GoalTrainingProgramFlow", () => {
  it("builds a goal-and-date preview from the selected experience without saving or applying it", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user)

    expect(mocks.createPreview).toHaveBeenCalledWith(expect.objectContaining({
      goalMinutes: 45,
      dateChoice: { kind: "START", startDate: "2026-10-18" },
      experienceBand: "EXPERIENCED",
      availableDayCount: 3,
      trainingTimePreference: "VARIES",
      goalPaceConfirmed: false,
    }))
    expect(screen.getByText("미리보기 · 아직 시작하지 않았어요")).toBeVisible()
    expect(screen.getByText("날짜를 누르면 운동 순서를 볼 수 있어요.")).toBeVisible()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("shows the deadline placement limit before opening any result details", async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByRole("button", { name: "50분 목표" }))
    await user.click(screen.getByRole("button", { name: "대회 날짜에 맞추기" }))
    fireEvent.change(screen.getByLabelText("대회 날짜"), { target: { value: "2026-11-15" } })
    await user.click(screen.getByRole("button", { name: "다음" }))
    await user.click(screen.getByRole("button", { name: "달리기를 막 시작했어요" }))
    await user.click(screen.getByRole("button", { name: /시간 기준으로 훈련/u }))
    expect(screen.getByText(/대회 날짜 · 2026-11-15/u)).toHaveTextContent("날짜만 맞춰요. 대회 전 훈련량을 자동으로 줄이지는 않아요.")
    expect(screen.getByText(/대회 날짜 · 2026-11-15/u)).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("saves only after the no-known-risk confirmation, then applies the first cycle", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))

    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce())
    expect(mocks.evaluateSafety).toHaveBeenCalledWith("NO_KNOWN_RISK")
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      goalMinutes: 45,
      dateChoice: { kind: "START", startDate: "2026-10-18" },
      safetyGate: GATE,
    }))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ programId: "goal-program-fixture" }), expect.objectContaining({
      expectedRevision: null,
      currentCheck: "NO_KNOWN_RISK",
      replaceExisting: false,
    }))
    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({
      programId: "goal-program-fixture",
      cycle: 1,
      confirmsNoKnownRisk: true,
    }))
    expect(await screen.findByRole("status")).toHaveTextContent("1차 9.5일 훈련을 시작했어요")
  })

  it("requires the over-duration confirmation separately from body-risk review", async () => {
    const user = userEvent.setup()
    mocks.durationReview.mockReturnValue({ required: true, maximumSeconds: 3140, longerWorkoutCount: 2 })
    renderFlow()
    await chooseGoalDateAndExperience(user)

    const startButton = screen.getByRole("button", { name: "이 계획 시작" })
    expect(startButton).toBeDisabled()
    expect(mocks.evaluateSafety).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText("최대 52분 20초 훈련시간을 확인했어요"))
    expect(startButton).toBeEnabled()
    expect(mocks.evaluateSafety).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()

    await user.click(startButton)
    expect(mocks.evaluateSafety).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      longerDurationConfirmed: true,
      safetyGate: GATE,
    })))
    expect(mocks.evaluateSafety).toHaveBeenCalledWith("NO_KNOWN_RISK")
    expect(mocks.save).toHaveBeenCalledOnce()
  })

  it("keeps a saved program when applying its first cycle fails and explains the partial save", async () => {
    const user = userEvent.setup()
    mocks.apply.mockResolvedValue({ kind: "rejected", code: "ACTIVE_PROGRAM_EXISTS" })
    renderFlow()
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    expect(await screen.findByRole("status")).toHaveTextContent("한 달 훈련표는 보관했지만 이번 9.5일 훈련은 시작하지 않았어요")
    expect(screen.getByRole("alert")).toHaveTextContent("진행 중인 계획을 먼저 확인해 주세요")
    expect(screen.getByText("10km 45분 목표")).toBeVisible()
    expect(screen.getAllByText("시작 전")).toHaveLength(3)
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.apply).toHaveBeenCalledOnce()
  })

  it("keeps an abnormal-body response as preview only", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    await user.click(screen.getByRole("button", { name: "통증·몸 이상이 있거나 잘 모르겠어요" }))

    expect(screen.getByRole("alert")).toHaveTextContent("몸 상태 확인 필요")
    expect(screen.getByText("미리보기 · 아직 시작하지 않았어요")).toBeVisible()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "이 계획 시작" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "몸 상태 다시 확인" }))
    expect(screen.getByRole("heading", { name: "지금 몸 상태는 어떤가요?" })).toHaveFocus()
    expect(mocks.evaluateSafety).not.toHaveBeenCalled()
    mocks.evaluateSafety.mockReturnValueOnce({ kind: "blocked" })
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "몸 상태 다시 확인" })).toBeEnabled())
    expect(mocks.evaluateSafety).toHaveBeenCalledExactlyOnceWith("NO_KNOWN_RISK")
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "몸 상태 다시 확인" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce())
    expect(mocks.evaluateSafety).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("몸 상태 확인 필요 · 이 훈련표로 훈련을 시작하지 마세요.")).not.toBeInTheDocument()
  })

  it("allows a preview in account scope but blocks activation and local-store writes", async () => {
    const user = userEvent.setup()
    mocks.owner = "synthetic-account"
    renderFlow()
    await chooseGoalDateAndExperience(user)

    expect(screen.getByRole("status")).toHaveTextContent("계정 저장이 아직 지원되지 않아요")
    expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("preserves the chosen goal and start date when backing out to revise the entry", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user, 45, "2026-10-18")
    await user.click(screen.getByRole("button", { name: "조건 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "경험·훈련 횟수 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "목표·날짜 바꾸기" }))

    expect(screen.getByLabelText("시작일")).toHaveValue("2026-10-18")
    expect(screen.getByText("10km 45분 목표 · 약 한 달 · 하루 최대 1회")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "목표 다시 선택" }))
    await user.click(screen.getByRole("button", { name: "40분 목표" }))

    expect(screen.getByLabelText("시작일")).toHaveValue("2026-10-18")
    expect(screen.getByText("10km 40분 목표 · 약 한 달 · 하루 최대 1회")).toBeVisible()
  })

  it("passes the visible goal-speed choice through preview and generated-plan inputs", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDate(user)
    expect(screen.getByText("3 / 4 · 달리기 경험")).toBeVisible()
    await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/u }))
    expect(screen.getByText("4 / 4 · 훈련 방식")).toBeVisible()
    expect(screen.getByRole("heading", { name: "어떤 방식으로 훈련할까요?" })).toHaveFocus()
    expect(screen.getByText("선택에 따라 훈련 구성과 시간도 달라져요.")).toBeVisible()
    expect(screen.getByRole("button", { name: /목표 속도로 연습/u })).toHaveTextContent("1km에 4분 30초 · 속도가 적힌 구간에서만 따라요")
    expect(mocks.createPreview).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /목표 속도로 연습/u }))

    expect(mocks.createPreview).toHaveBeenCalledWith(expect.objectContaining({ goalPaceConfirmed: true }))
    expect(screen.getByText("목표 속도 · 1km에 4분 30초 · 속도가 적힌 구간에서만 따라요")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ goalPaceConfirmed: true }))
  })

  it("offers a paused saved cycle for reconnection after a fresh no-known-risk check", async () => {
    currentDocument = makeStoredDocument(programFor(latestPreview))
    currentDocument.cycles[0]!.status = "CURRENT"
    currentDocument.application = { appliedAt: "2026-10-10T00:00:00.000Z", currentCycleIndex: 1 }
    forcedStatus = "PAUSED"
    const user = userEvent.setup()
    renderFlow()

    expect(screen.getByRole("status")).toHaveTextContent("복원한 훈련표예요")
    await user.click(screen.getByRole("button", { name: "이번 훈련 다시 연결" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({
      programId: "goal-program-fixture",
      expectedRevision: 1,
      cycle: 1,
      confirmsNoKnownRisk: true,
    })))
    expect(mocks.evaluateSafety).toHaveBeenCalledWith("NO_KNOWN_RISK")
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it("requires explicit replacement confirmation before saving over a stored program", async () => {
    currentDocument = makeStoredDocument(programFor(latestPreview))
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByText("목표·날짜를 바꿔 새로 만들기"))
    await user.click(screen.getByRole("button", { name: "새 훈련표 만들기" }))
    await chooseGoalDateAndExperience(user)

    const startButton = screen.getByRole("button", { name: "이 계획 시작" })
    expect(startButton).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled()
    await user.click(screen.getByLabelText("이전 훈련표를 보관하고 새 훈련표로 바꿀게요"))
    expect(startButton).toBeEnabled()
    await user.click(startButton)
    expect(mocks.save).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ programId: "goal-program-fixture" }), expect.objectContaining({
      expectedRevision: 1,
      replaceExisting: true,
    })))
  })

  it("returns to entry when a failed saved-program read is retried and confirms the program is missing", async () => {
    const user = userEvent.setup()
    forcedRead = "storage_error"
    renderFlow()
    expect(screen.getByRole("button", { name: "다시 확인" })).toBeVisible()

    forcedRead = "missing"
    await user.click(screen.getByRole("button", { name: "다시 확인" }))

    expect(await screen.findByRole("heading", { name: "10km, 몇 분을 목표로 할까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "60분 목표" })).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("requires a new replacement review when another tab changes the stored program", async () => {
    currentDocument = makeStoredDocument(programFor(latestPreview))
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByText("목표·날짜를 바꿔 새로 만들기"))
    await user.click(screen.getByRole("button", { name: "새 훈련표 만들기" }))
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByLabelText("이전 훈련표를 보관하고 새 훈련표로 바꿀게요"))
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    expect(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" })).toBeVisible()

    currentDocument = { ...currentDocument!, revision: 2 }
    act(() => mocks.subscribe.mock.calls.at(-1)?.[0]())

    expect(screen.queryByRole("button", { name: "통증 없고 평소와 같아요 · 시작" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
    expect(screen.getByLabelText("이전 훈련표를 보관하고 새 훈련표로 바꿀게요")).not.toBeChecked()
    expect(screen.getByText("10km 45분 목표")).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("returns to the saved program when a new-program entry is cancelled", async () => {
    currentDocument = makeStoredDocument(programFor(latestPreview))
    const original = currentDocument
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderFlow(onClose)
    await user.click(screen.getByText("목표·날짜를 바꿔 새로 만들기"))
    await user.click(screen.getByRole("button", { name: "새 훈련표 만들기" }))
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(screen.getByRole("heading", { name: "10km 45분 목표" })).toBeVisible()
    expect(currentDocument).toBe(original)
    expect(onClose).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("allows the supported account route after hydration without describing it as device storage", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("EMPTY")
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    expect(mocks.refresh).toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.apply).toHaveBeenCalledOnce()
    expect(screen.getByText("계정에서 확인한 훈련표")).toBeVisible()
    expect(screen.queryByText("이 기기에 보관된 훈련표")).not.toBeInTheDocument()
  })

  it("preserves a preview while account saving is pending and never calls activation", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("EMPTY")
    mocks.save.mockImplementation(async () => {
      mocks.storageStatus.mockReturnValue("PENDING")
      return { kind: "rejected", code: "ACCOUNT_PROGRAM_PENDING" }
    })
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    expect(await screen.findByRole("status")).toHaveTextContent("동기화 대기 중")
    expect(screen.getByText("미리보기 · 아직 시작하지 않았어요")).toBeVisible()
    expect(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" })).toBeDisabled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it.each([false, true])("explicitly selects a new date and confirms an expired pending original (confirmed program: %s)", async hasConfirmed => {
    const review = expiredPendingDateReview(hasConfirmed), original = currentDocument
    mocks.save.mockImplementation(async (program: GoalTrainingProgram) => {
      currentDocument = makeStoredDocument(program); mocks.storageStatus.mockReturnValue("READY")
      return { kind: "saved", document: currentDocument }
    })
    const user = userEvent.setup()
    renderFlow()
    expect(screen.getByText("초안의 시작일이 지났어요. 날짜를 다시 고르면 이전 초안도 보관해요.")).toBeVisible()
    await chooseNewPendingDate(user)
    expect(currentDocument).toBe(original)
    expect(review.pendingDocument.program.window.startDate).toBe(START)
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
    if (hasConfirmed) {
      expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
      await user.click(screen.getByLabelText("이전 훈련표를 보관하고 새 훈련표로 바꿀게요"))
    }
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ window: expect.objectContaining({ startDate: "2026-10-18" }) }),
      expect.objectContaining({ expectedRevision: original?.revision ?? null, currentCheck: "NO_KNOWN_RISK", replaceExisting: hasConfirmed, replaceExpiredPending: true }))
    expect(mocks.apply).toHaveBeenCalledOnce()
    expect(mocks.conflictBackup).not.toHaveBeenCalled()
    expect(review.pendingDocument.program.window.startDate).toBe(START)
  })

  it("does not allow an expired pending save without the explicit recovery choice", async () => {
    expiredPendingDateReview()
    const user = userEvent.setup(); renderFlow()
    await chooseGoalDateAndExperience(user)
    expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
  })

  it.each(["unmarked", "future"])("keeps ordinary pending blocked when it is %s", async variant => {
    const review = expiredPendingDateReview()
    mocks.accountSnapshot.mockReturnValue(variant === "unmarked" ? { ...review, goalStartDateReviewRequired: undefined }
      : { ...review, pendingDocument: makeStoredDocument(programFor(previewFor({ ...latestPreview.inputs,
        goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-18" }, generatedAt: latestPreview.generatedAt }))) })
    const user = userEvent.setup(); renderFlow()
    expect(screen.queryByRole("button", { name: "날짜를 다시 골라 보관하기" })).not.toBeInTheDocument()
    await chooseGoalDateAndExperience(user)
    expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("keeps the pending original when a reselected date expires before confirmation", async () => {
    const review = expiredPendingDateReview(), pending = structuredClone(review.pendingDocument)
    const user = userEvent.setup(); renderFlow()
    await chooseNewPendingDate(user)
    await user.click(screen.getByRole("button", { name: "이 계획 시작" }))
    mocks.today = "2026-10-19"
    mocks.generate.mockReturnValueOnce({ kind: "start-in-past", requiredStartDate: "2026-10-18", suggestedStartDate: mocks.today })
    await user.click(screen.getByRole("button", { name: "통증 없고 평소와 같아요 · 시작" }))
    expect(screen.getByRole("alert")).toHaveTextContent("날짜")
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
    expect(review.pendingDocument).toEqual(pending)
  })

  it("invalidates expired pending recovery when the reviewed source changes", async () => {
    const review = expiredPendingDateReview()
    const user = userEvent.setup(); renderFlow()
    await chooseNewPendingDate(user)
    mocks.accountSnapshot.mockReturnValue({ ...review, sequence: 3 })
    act(() => mocks.subscribe.mock.calls.at(-1)?.[0]())
    expect(screen.getByRole("button", { name: "이 계획 시작" })).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("exports an expired pending original without publishing or choosing the account program", async () => {
    const review = expiredPendingDateReview(), raw = JSON.stringify({ document: review.pendingDocument, history: review.history })
    mocks.refresh.mockResolvedValue(false); mocks.conflictBackup.mockResolvedValue(raw)
    const create = vi.fn().mockReturnValue("blob:synthetic-pending"), revoke = vi.fn()
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: create })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    try {
      renderFlow()
      fireEvent.click(screen.getByRole("button", { name: "대기 중 초안 파일로 보관" }))
      await waitFor(() => expect(create).toHaveBeenCalledWith(expect.any(Blob)))
      expect(mocks.conflictBackup).toHaveBeenCalledExactlyOnceWith(review)
      expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
      expect(mocks.acceptRemote).not.toHaveBeenCalled()
      await new Promise(resolve => setTimeout(resolve, 1050))
      expect(revoke).toHaveBeenCalledWith("blob:synthetic-pending")
    } finally {
      click.mockRestore()
      Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: oldCreate })
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: oldRevoke })
    }
  })

  it("does not replace an in-progress entry when a stored account program arrives late", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("LOADING")
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByRole("button", { name: "40분 목표" }))
    currentDocument = makeStoredDocument(programFor(latestPreview))
    mocks.storageStatus.mockReturnValue("READY")
    act(() => mocks.subscribe.mock.calls.at(-1)?.[0]())
    expect(screen.getByText("10km 40분 목표 · 약 한 달 · 하루 최대 1회")).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("loads the saved account result when hydration finishes before entry starts", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("LOADING")
    renderFlow()
    currentDocument = makeStoredDocument(programFor(latestPreview))
    mocks.storageStatus.mockReturnValue("READY")
    act(() => mocks.subscribe.mock.calls.at(-1)?.[0]())
    expect(screen.getByRole("heading", { name: "10km 45분 목표" })).toBeVisible()
    expect(screen.getByText("계정에서 확인한 훈련표")).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("offers an explicit today restart after midnight without silently moving the chosen dates", async () => {
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDate(user, 45, START)
    await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/u }))
    mocks.today = "2026-10-12"
    mocks.createPreview.mockReturnValueOnce({ kind: "start-in-past", requiredStartDate: START, suggestedStartDate: mocks.today })
    await user.click(screen.getByRole("button", { name: /목표 속도로 연습/u }))
    expect(screen.getByRole("alert")).toHaveTextContent("시작일이 지났어요")
    expect(mocks.save).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "오늘부터 약 한 달 계획 보기" }))
    expect(mocks.createPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      dateChoice: { kind: "START", startDate: "2026-10-12" }, goalMinutes: 45, goalPaceConfirmed: true,
    }))
    expect(screen.getByText("미리보기 · 아직 시작하지 않았어요")).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("requires opening the conflict review and an explicit account choice without activating a plan", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("CONFLICT")
    const review = { document: makeStoredDocument(programFor(latestPreview)), pendingDocument: makeStoredDocument(programFor(latestPreview)) }
    mocks.accountSnapshot.mockReturnValue(review)
    const user = userEvent.setup()
    renderFlow()
    expect(mocks.acceptRemote).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "두 훈련표 확인" }))
    expect(screen.getByRole("heading", { name: "어떤 훈련표를 사용할까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이 기기 초안 파일로 보관" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "계정 훈련표 사용" }))
    expect(mocks.acceptRemote).toHaveBeenCalledExactlyOnceWith(review)
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 상태가 바뀌었어요")
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("shows the explicitly chosen account result instead of the previous local preview after conflict resolution", async () => {
    mocks.owner = "synthetic-account"
    mocks.storageStatus.mockReturnValue("CONFLICT")
    const remote = makeStoredDocument(programFor(latestPreview))
    mocks.accountSnapshot.mockImplementation(() => ({ document: remote, pendingDocument: makeStoredDocument(programFor(latestPreview)) }))
    mocks.acceptRemote.mockImplementation(async () => {
      currentDocument = remote
      mocks.storageStatus.mockReturnValue("READY")
      return true
    })
    const user = userEvent.setup()
    renderFlow()
    await chooseGoalDateAndExperience(user, 30)
    expect(screen.getByRole("heading", { name: "10km 30분 목표" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "두 훈련표 확인" }))
    await user.click(screen.getByRole("button", { name: "계정 훈련표 사용" }))
    expect(await screen.findByRole("heading", { name: "10km 45분 목표" })).toBeVisible()
    expect(screen.queryByText("미리보기 · 아직 시작하지 않았어요")).not.toBeInTheDocument()
    expect(screen.getByText("계정에서 확인한 훈련표")).toBeVisible()
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
