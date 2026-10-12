import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PrescriptionSequence, PrescriptionSequenceSegment } from "@impl/prescription/sequence"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { WorkoutNotation, SessionWorkoutNotation } from "./WorkoutNotation"
import { presentSessionWorkoutNotation, presentWorkoutNotation } from "./workout-notation-presentation"

afterEach(cleanup)

const cue = "힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 RPE 6~7"
const fullPlainCue = "힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 힘든 정도 6–7/10"
const segment = (overrides: Partial<Extract<SequenceNodeV3, { kind: "segment" }>> = {}): Extract<SequenceNodeV3, { kind: "segment" }> => ({
  kind: "segment", id: "main", label: "합성 확인용", role: "WORK", repeatCount: 2,
  work: { kind: "duration", durationSeconds: 600, distanceM: null },
  target: { kind: "EFFORT_GUIDANCE", cue },
  recoveryBetweenRepeats: [{ mode: "JOG", seconds: 60 }], recoveryAfter: [], ...overrides,
})
const sequence = (main: readonly SequenceNodeV3[] = [segment()]): PrescriptionSequenceV3 => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC_DISPLAY_ONLY", label: null,
  warmup: [], main, cooldown: [],
})

describe("concise workout instruction and optional effort detail", () => {
  it("keeps the exact workout visible and the full effort cue available in named help", () => {
    const source = sequence(), before = JSON.stringify(source)
    const { container } = render(<WorkoutNotation sequence={source} intent="LT_INTENT" />)
    expect(container.querySelector("code")).toHaveTextContent("2 × 10분 · 힘든 정도 6–7/10 (제안) · 반복 사이 60초 조깅")
    expect(container.querySelector("code")).not.toHaveTextContent("고르게 유지하는 노력")
    const explanation = screen.getByText(fullPlainCue)
    expect(explanation).not.toBeVisible()
    fireEvent.click(screen.getByText("강도 안내"))
    expect(explanation).toBeVisible()
    expect(JSON.stringify(source)).toBe(before)
  })

  it("recognizes the exact catalog cue without changing its original source text", () => {
    const catalogCue = "힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 RPE 6~7"
    const source = sequence([segment({ target: { kind: "EFFORT_GUIDANCE", cue: catalogCue } })])
    expect(presentWorkoutNotation(source)).toEqual({
      notation: "2 × 10분 · 힘든 정도 6–7/10 (제안) · 반복 사이 60초 조깅",
      explanations: ["힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 힘든 정도 6–7/10"],
    })
    expect(source.main[0]).toMatchObject({ target: { cue: catalogCue } })
  })

  it("keeps the reviewed easy-run cue concise without hiding its exact intensity or source", () => {
    const baseCue = "문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 RPE 3~4"
    const source = sequence([segment({ repeatCount: 1, work: { kind: "duration", durationSeconds: 1200, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: baseCue }, recoveryBetweenRepeats: [] })])
    const before = JSON.stringify(source)
    const { container } = render(<WorkoutNotation sequence={source} />)
    expect(container.querySelector("code")).toHaveTextContent("20분 · 힘든 정도 3–4/10 (제안)")
    expect(container.querySelector("code")).not.toHaveTextContent("문장으로 대화")
    const explanation = screen.getByText("문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 힘든 정도 3–4/10")
    expect(explanation).not.toBeVisible()
    fireEvent.click(screen.getByText("강도 안내"))
    expect(explanation).toBeVisible()
    expect(JSON.stringify(source)).toBe(before)
  })

  it("uses the same concise projection in session comparisons without modifying an adjusted prescription", () => {
    const source = { role: "QUALITY", plannedEnergyIntent: "LT_INTENT" as const,
      prescription: { kind: "ADJUSTED_METHOD_V3" as const, projection: { sequence: sequence(), segmentTargets: [] } } }
    const before = JSON.stringify(source)
    const { container } = render(<SessionWorkoutNotation session={source} />)
    expect(container.querySelector("span")).toHaveTextContent("2 × 10분 · 힘든 정도 6–7/10 (제안) · 반복 사이 60초 조깅")
    expect(container.querySelector("span")).not.toHaveTextContent("고르게 유지")
    expect(screen.getByText(fullPlainCue)).not.toBeVisible()
    fireEvent.click(screen.getByText("강도 안내"))
    expect(screen.getByText(fullPlainCue)).toBeVisible()
    expect(JSON.stringify(source)).toBe(before)
    expect(presentSessionWorkoutNotation({ role: "EASY", plannedEnergyIntent: "BASE_INTENT",
      prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 20, maximum: 25 }, rpe: { minimum: 3, maximum: 4 } } }))
      .toEqual({ notation: "전체 20–25분 · 힘든 정도 3–4/10", explanations: [] })
  })

  it.each([
    `통증이 생기면 중단 · ${cue}`,
    "RPE 6~7 · 전력질주하지 않기",
    "RPE 6 / RPE 8 · 구간마다 다르게 달리기",
    "RPE 12 · 강도 확인 필요",
    "통증이 생기면 중단 · 문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 RPE 3~4",
  ])("does not hide unknown instructions or safety limits: %s", unknownCue => {
    const { container } = render(<WorkoutNotation sequence={sequence([segment({ target: { kind: "EFFORT_GUIDANCE", cue: unknownCue } })])} />)
    expect(screen.queryByText("강도 안내")).toBeNull()
    expect(container.querySelector("code")).toHaveTextContent(unknownCue.replace("RPE 6~7", "힘든 정도 6–7/10").replace("RPE 3~4", "힘든 정도 3–4/10"))
  })

  it("preserves nested sets, each target and both types of recovery in the concise line", () => {
    const source = sequence([{
      kind: "group", id: "sets", label: null, repeatUnit: "SET", repeatCount: 3,
      recoveryBetweenRepeats: [{ mode: "WALK", seconds: 180 }],
      recoveryAfter: [{ mode: "STAND", seconds: 17 }],
      children: [segment(), segment({ id: "pace", repeatCount: 1,
        work: { kind: "distance", distanceM: 200, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: "synthetic" },
        recoveryBetweenRepeats: [], recoveryAfter: [{ mode: "JOG", distanceM: 100, seconds: null }] })],
    }])
    const before = JSON.stringify(source)
    const presentation = presentWorkoutNotation(source, [{ kind: "CURRENT_SAME_EVENT_RACE_PACE", segmentId: "pace", secondsPerKm: 160,
      targetRepSeconds: 32, distanceM: 200, fixedWorkSeconds: null, missing: null }])
    expect(presentation.notation).toBe("3 세트 × (2 × 10분 · 힘든 정도 6–7/10 (제안) · 반복 사이 60초 조깅 → 200m · 32초/200m · 800m 경기 평균 페이스 → 종료 뒤 100m 조깅) · 세트 사이 3분 걷기 → 종료 뒤 17초 서서 쉬기")
    expect(presentation.explanations).toEqual([fullPlainCue])
    expect(JSON.stringify(source)).toBe(before)
  })

  it("preserves legacy conditional and terminal recovery instead of adding a last repeat rest", () => {
    const old: PrescriptionSequenceSegment = {
      kind: "segment", id: "a", label: null, repeatCount: 1,
      work: { kind: "duration", durationSeconds: 1200, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue },
      recoveryBetweenRepeats: { mode: "NOT_APPLICABLE", seconds: null }, recoveryAfter: { mode: "JOG", seconds: 60 },
    }
    const source: PrescriptionSequence = {
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "legacy", label: null,
      warmup: [], main: [old], cooldown: [], terminalRecovery: { mode: "WALK", seconds: 180 },
    }
    const before = JSON.stringify(source)
    expect(presentWorkoutNotation(source).notation).toBe("20분 · 힘든 정도 6–7/10 (제안) → 마지막 본운동 뒤 3분 걷기")
    expect(presentWorkoutNotation({ ...source, version: 1, main: [old, { ...old, id: "b" }] }).notation)
      .toBe("20분 · 힘든 정도 6–7/10 (제안) → 종료 뒤 60초 조깅 → 20분 · 힘든 정도 6–7/10 (제안)")
    expect(JSON.stringify(source)).toBe(before)
  })

  it("closes only expanded effort help on Escape and returns focus before the enclosing editor", () => {
    const onOuterEscape = vi.fn()
    render(<div onKeyDown={onOuterEscape}><WorkoutNotation sequence={sequence()} /></div>)
    const summary = screen.getByText("강도 안내")
    fireEvent.click(summary)
    fireEvent.keyDown(summary, { key: "Escape" })
    expect(summary.closest("details")).not.toHaveAttribute("open")
    expect(summary).toHaveFocus()
    expect(onOuterEscape).not.toHaveBeenCalled()
    fireEvent.keyDown(summary, { key: "Escape" })
    expect(onOuterEscape).toHaveBeenCalledOnce()
  })

  it("keeps missing intensity visible and updates without retaining another workout's explanation", () => {
    const { container, rerender } = render(<WorkoutNotation sequence={sequence()} />)
    rerender(<WorkoutNotation sequence={sequence([segment({ repeatCount: 1,
      work: { kind: "duration", durationSeconds: null, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: null }, recoveryBetweenRepeats: [],
    })])} />)
    expect(container.querySelector("code")).toHaveTextContent("시간 미지정 · 강도 미지정")
    expect(screen.queryByText("강도 안내")).toBeNull()
    expect(screen.queryByText(fullPlainCue)).toBeNull()
  })
})
