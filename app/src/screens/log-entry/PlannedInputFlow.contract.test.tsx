import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QuickSessionForm } from "./QuickSessionForm"
import { PostSessionForm } from "./PostSessionForm"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { repetitionFixture, REPETITION_TEST_NOW } from "../../domain/planned-repetition.test-fixture"
import { saveEntry } from "../../domain/journal-store"
import { sessionWorkoutName, sessionWorkoutNotation } from "../../domain/workout-notation"
vi.mock("../../domain/journal-original-plan", () => ({ readJournalOriginalPlan: vi.fn() }))
vi.mock("../../domain/journal-store", async importOriginal => ({ ...await importOriginal<object>(), saveEntry: vi.fn(() => ({ ok: true })) }))
let fixture: ReturnType<typeof repetitionFixture>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  vi.useFakeTimers(); vi.setSystemTime(REPETITION_TEST_NOW)
  fixture = repetitionFixture(); vi.useRealTimers()
  vi.mocked(readJournalOriginalPlan).mockReturnValue(fixture.original)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe("linked journal context and invalid actual-input guard", () => {
  it("shows the exact original title and notation before asking how the workout went", () => {
    render(<QuickSessionForm targetDate={fixture.entry.date} plannedSessionLink={fixture.link} />)
    expect(screen.getByRole("region", { name: "기록할 훈련의 원래 계획" })).toHaveTextContent(sessionWorkoutName(fixture.session))
    expect(screen.getByRole("region", { name: "기록할 훈련의 원래 계획" })).toHaveTextContent(sessionWorkoutNotation(fixture.session))
    expect(saveEntry).not.toHaveBeenCalled()
  })
  it("does not substitute a different current plan when the linked original is missing", () => {
    vi.mocked(readJournalOriginalPlan).mockReturnValue({ kind: "unavailable" })
    render(<QuickSessionForm targetDate={fixture.entry.date} plannedSessionLink={fixture.link} />)
    expect(screen.getByText(/원래 훈련 내용을 확인하지 못했어요/)).toBeVisible()
    expect(screen.queryByRole("region", { name: "기록할 훈련의 원래 계획" })).toBeNull()
  })
  it("blocks quick save and retains an invalid number through add-exercise and return", () => {
    render(<QuickSessionForm targetDate={fixture.entry.date} plannedSessionLink={fixture.link} />)
    fireEvent.click(screen.getByRole("button", { name: "계획대로 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: /RPE 6,/ }))
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
    fireEvent.click(screen.getByText("반복별 기록 남기기"))
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 시간"), { target: { value: "-12" } })
    fireEvent.click(screen.getByRole("button", { name: "운동 추가·수정" }))
    fireEvent.click(screen.getByRole("button", { name: "기록 요약으로" }))
    fireEvent.click(screen.getByText("반복별 기록 남기기"))
    expect(screen.getByLabelText("1세트 1회 실제 시간")).toHaveValue("-12")
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(saveEntry).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 시간"), { target: { value: "222.4" } })
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    expect(saveEntry).toHaveBeenCalledOnce()
    const saved = vi.mocked(saveEntry).mock.calls[0]![0]
    expect(saved).not.toHaveProperty("plannedInputs")
    expect(saved).toMatchObject({ exerciseLog: { plannedRepetitions: { results: [{ set: 1, repetition: 1, seconds: 222.4 }] } } })
  })
  it("blocks detailed-form save with invalid actual input and allows explicit clearing", () => {
    render(<PostSessionForm targetDate={fixture.entry.date} plannedSessionLink={fixture.link} />)
    fireEvent.click(screen.getByText("반복별 기록 남기기"))
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 시간"), { target: { value: "90000" } })
    fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
    expect(saveEntry).not.toHaveBeenCalled()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    fireEvent.click(screen.getByRole("button", { name: "입력한 반복 기록 지우기" }))
    fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
    expect(saveEntry).toHaveBeenCalledOnce()
    expect(vi.mocked(saveEntry).mock.calls[0]![0]).not.toHaveProperty("exerciseLog")
  })
})
