import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { parsePrescriptionSequence } from "@impl/prescription/sequence"
import { PrescriptionStructure } from "./PrescriptionStructure"

function sequence(version: 1 | 2, recovery: object, terminalRecovery?: object) {
  const none = { mode: "NOT_APPLICABLE", seconds: null }
  const result = parsePrescriptionSequence({
    kind: "PRESCRIPTION_SEQUENCE", version, id: "representation-only", label: null,
    warmup: [], cooldown: [],
    main: [{
      id: "work", kind: "segment", label: "거리 반복", repeatCount: 12,
      work: { kind: "distance", distanceM: 400, durationSeconds: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "정해진 강도" },
      recoveryBetweenRepeats: recovery, recoveryAfter: none,
    }],
    ...(version === 2 ? { terminalRecovery } : {}),
  })
  if (result.kind !== "parsed") throw new Error(`Invalid test fixture: ${result.path}`)
  return result.sequence
}

describe("prescription sequence recovery display", () => {
  it("shows distance recovery and the final recovery without pretending metres are seconds", () => {
    const recovery = { mode: "ACTIVE_ROLL_ON", distanceM: 100, seconds: null }
    const { container } = render(<PrescriptionStructure sequence={sequence(2, recovery, recovery)} />)
    expect(container).toHaveTextContent("반복 사이: 100m 속도를 낮춰 이어 달리기 · 11번")
    expect(container).toHaveTextContent("마지막 본운동 뒤: 100m 속도를 낮춰 이어 달리기")
    expect(container).toHaveTextContent("본운동 거리: 4800m")
    expect(container).toHaveTextContent("회복 거리 1200m")
    expect(container).toHaveTextContent("본운동에 연결된 회복: 시간 미지정")
    expect(container).not.toHaveTextContent("100초")
    expect(screen.getByText(/전체 수행시간은 확정하지 않아요/u)).toBeVisible()
  })
  it("preserves version 1 time recovery and does not invent a final recovery", () => {
    const { container } = render(<PrescriptionStructure sequence={sequence(1, { mode: "JOG", seconds: 60 })} />)
    expect(container).toHaveTextContent("반복 사이: 60초 가벼운 조깅 · 11번")
    expect(container).toHaveTextContent("본운동에 연결된 회복: 660초")
    expect(container).not.toHaveTextContent("마지막 본운동 뒤")
    expect(container).not.toHaveTextContent("회복 거리")
  })
  it("does not invent a terminal occurrence when version 2 explicitly has none", () => {
    const { container } = render(<PrescriptionStructure sequence={sequence(2,
      { mode: "JOG", distanceM: 100, seconds: null }, { mode: "NOT_APPLICABLE", seconds: null })} />)
    expect(container).toHaveTextContent("회복 거리 1100m")
    expect(container).not.toHaveTextContent("마지막 본운동 뒤")
  })
})
