import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadEntries, saveEntry } from "../../domain/journal-store"
import { PostSessionForm } from "./PostSessionForm"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
  while (screen.queryByRole("button", { name: "다음 질문" })) {
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
  }
}

describe("post-session energy provenance", () => {
  it("saves an untouched energy system as missing instead of defaulting to BASE", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PostSessionForm onDone={onDone} />)

    await user.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    await user.click(screen.getByRole("button", { name: /저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const entry = onDone.mock.calls[0]?.[1]

    expect(entry?.kind).toBe("post-session")
    if (entry?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(entry.system).toBe("")
    expect(entry.fieldProvenance?.system).toEqual({ provenance: "MISSING" })
  })

  it("records the system only after the user directly chooses it", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PostSessionForm onDone={onDone} />)

    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    await user.click(screen.getByRole("button", { name: "LT 지속 페이스" }))
    await advanceToReview(user)
    await user.click(screen.getByRole("button", { name: /저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const entry = onDone.mock.calls[0]?.[1]

    expect(entry?.kind).toBe("post-session")
    if (entry?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(entry.system).toBe("lt")
    expect(entry.fieldProvenance?.system).toEqual({ provenance: "EXPLICIT" })
  })

  it("clears performed-session facts when a quick record is detailed as rest", async () => {
    const original = {
      id: "quick-to-detailed-rest",
      kind: "post-session" as const,
      date: "2026-09-02",
      savedAt: "2026-09-02T00:00:00.000Z",
      syncState: "local" as const,
      captureDepth: "QUICK" as const,
      activityOutcome: "COMPLETED" as const,
      activitySlot: "AM" as const,
      objectiveDataState: "CONFIRMED" as const,
      planExecutionRelation: "NOT_APPLICABLE" as const,
      painCheckStatus: "NO_SIGNAL_REPORTED" as const,
      system: "base",
      title: "운동 완료",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
      intensityAssessment: { schemaVersion: 1 as const, plannedRpe: 6, objectiveComponents: [] },
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" as const },
        activitySlot: { provenance: "EXPLICIT" as const },
        plannedSessionLink: { provenance: "MISSING" as const },
        planExecutionRelation: {
          provenance: "DERIVED" as const,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        painCheckStatus: { provenance: "EXPLICIT" as const },
        painParts: { provenance: "MISSING" as const },
        system: { provenance: "EXPLICIT" as const },
        distanceKm: { provenance: "EXPLICIT" as const },
        durationMin: { provenance: "EXPLICIT" as const },
        avgPace: { provenance: "EXPLICIT" as const },
        rpe: { provenance: "EXPLICIT" as const },
        plannedRpe: { provenance: "EXPLICIT" as const },
        objectiveComponents: { provenance: "MISSING" as const },
      },
    }
    expect(saveEntry(original).ok).toBe(true)
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PostSessionForm initialEntry={original} onDone={onDone} />)

    await user.click(screen.getByRole("button", { name: "운동 결과 수정" }))
    await user.click(screen.getByRole("button", { name: "휴식" }))
    expect(screen.queryByRole("button", { name: "BASE 기초 지구력" })).toBeNull()
    expect(screen.queryByRole("button", { name: "6" })).toBeNull()
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())

    const [stored] = loadEntries()
    expect(stored).toMatchObject({
      id: original.id,
      captureDepth: "DETAILED",
      activityOutcome: "RESTED",
      objectiveDataState: "NONE",
      system: "",
      title: "휴식",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
    })
    if (stored?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(stored.activitySlot).toBeUndefined()
    expect(stored.painCheckStatus).toBeUndefined()
    expect(stored.painParts).toBeUndefined()
    expect(stored.intensityAssessment).toBeUndefined()
    expect(stored.fieldProvenance?.activitySlot).toBeUndefined()
    expect(stored.fieldProvenance?.painCheckStatus).toBeUndefined()
    expect(stored.fieldProvenance?.plannedRpe).toBeUndefined()
    expect(stored.fieldProvenance?.objectiveComponents).toBeUndefined()
  })

  it("asks one question at a time and sends existing entries to a concise review", async () => {
    const user = userEvent.setup()
    const original = {
      id: "review-fixture",
      kind: "post-session" as const,
      date: "2026-09-02",
      savedAt: "2026-09-02T00:00:00.000Z",
      syncState: "local" as const,
      captureDepth: "QUICK" as const,
      activityOutcome: "COMPLETED" as const,
      system: "base",
      title: "달리기",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "synthetic review note",
    }
    render(<PostSessionForm initialEntry={original} />)

    expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
    expect(screen.getByText("synthetic review note")).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "세션 제목" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "거리 (km)" })).toBeNull()
    expect(screen.queryByRole("button", { name: "6" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "거리와 시간 수정" }))
    expect(screen.getByRole("heading", { level: 2, name: "거리와 시간을 남겨요" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "거리 (km)" })).toHaveValue("5")
    expect(screen.queryByRole("textbox", { name: "세션 제목" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
    expect(screen.getByText("synthetic review note")).toBeVisible()
  })
})
