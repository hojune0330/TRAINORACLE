import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { loadAnalysisEntries, loadEntries } from "../../domain/journal-store"
import { QuickSessionForm } from "./QuickSessionForm"

function finishPerformedSession(rpe = 6): void {
  fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
  fireEvent.click(screen.getByRole("button", { name: "오후" }))
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`RPE ${rpe},`) }))
  fireEvent.click(screen.getByRole("button", { name: "없어요" }))
}

describe("quick session journal contract", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
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
    fireEvent.click(screen.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요" }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))

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
    fireEvent.click(screen.getByRole("button", { name: "일지 더 쓰기" }))

    const [entry] = loadEntries()
    expect(loadEntries()).toHaveLength(1)
    expect(onContinueDetailed).toHaveBeenCalledWith(expect.objectContaining({ id: entry?.id }))
  })

  it("allows a saved choice to be corrected without creating a duplicate", () => {
    render(<QuickSessionForm />)
    finishPerformedSession(6)
    const original = loadEntries()[0]

    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "하던 운동을 일부만 했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /RPE 7,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))

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

    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))

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
    fireEvent.click(screen.getByRole("button", { name: /RPE 5,/ }))
    fireEvent.click(screen.getByRole("button", { name: "있어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))

    expect(screen.getByRole("alert")).toHaveTextContent("하나 이상")
    expect(loadEntries()).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: /오른 무릎, 통증 없음/ }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))
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

    expect(screen.queryByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요")
    setItem.mockRestore()
  })
})
