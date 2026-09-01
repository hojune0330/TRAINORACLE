import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { loadEntries } from "../../domain/journal-store"
import { QuickSessionForm } from "./QuickSessionForm"

describe("quick session journal contract", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("finishes a common path in two answers and keeps the RPE band exact", () => {
    const onDone = vi.fn()
    render(<QuickSessionForm onDone={onDone} />)

    fireEvent.click(screen.getByRole("button", { name: "계획한 훈련을 했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "한 번" }))
    fireEvent.click(screen.getByRole("button", { name: /5~6/ }))

    expect(screen.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
    const [entry] = loadEntries()
    expect(entry).toMatchObject({
      kind: "post-session",
      captureDepth: "QUICK",
      activityOutcome: "COMPLETED",
      activitySlot: "SINGLE",
      rpeBand: "RPE_5_6",
      rpe: 0,
      distanceKm: "",
      durationMin: "",
      objectiveDataState: "WAITING",
      fieldProvenance: {
        rpe: { provenance: "MISSING" },
        distanceKm: { provenance: "MISSING" },
        durationMin: { provenance: "MISSING" },
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "완료" }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: entry?.id }))
  })

  it("does not invent an effort value when the athlete chooses 모르겠어요", () => {
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "한 번" }))
    fireEvent.click(screen.getByRole("button", { name: /모르겠어요/ }))

    const [entry] = loadEntries()
    expect(entry).toMatchObject({
      activityOutcome: "RESTED",
      rpeBand: "UNKNOWN",
      rpe: 0,
      fieldProvenance: {
        rpeBand: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    })
  })

  it("hands the saved entry to detail editing without creating another id", () => {
    const onContinueDetailed = vi.fn()
    render(<QuickSessionForm onContinueDetailed={onContinueDetailed} />)

    fireEvent.click(screen.getByRole("button", { name: "가볍게 움직였어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /3~4/ }))
    fireEvent.click(screen.getByRole("button", { name: "일지 더 쓰기" }))

    const [entry] = loadEntries()
    expect(loadEntries()).toHaveLength(1)
    expect(entry).toMatchObject({ activitySlot: "AM" })
    expect(onContinueDetailed).toHaveBeenCalledWith(expect.objectContaining({ id: entry?.id }))
  })

  it("shows no success state when local storage rejects the write", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "훈련을 건너뛰었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오후" }))
    fireEvent.click(screen.getByRole("button", { name: /모르겠어요/ }))

    expect(screen.queryByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요")
    setItem.mockRestore()
  })

  it("locks the written choices after saving so the same action cannot create a duplicate", () => {
    render(<QuickSessionForm />)

    fireEvent.click(screen.getByRole("button", { name: "계획한 훈련을 했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "한 번" }))
    fireEvent.click(screen.getByRole("button", { name: /5~6/ }))

    expect(screen.getByRole("button", { name: /훈련 완료/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /RPE 5~6/ })).toBeDisabled()
    expect(loadEntries()).toHaveLength(1)
  })
})
