import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { configurationReferenceV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { PrescriptionAdjustmentEditorV3 } from "./PrescriptionAdjustmentEditorV3"

const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup()
  for (const [key, descriptor] of [["showModal", show], ["close", close]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
  vi.restoreAllMocks()
})

// Synthetic arithmetic configurations, never an operating training approval.
function fixture() {
  const sequence = (repeats: number): PrescriptionSequenceV3 => ({
    kind: "PRESCRIPTION_SEQUENCE", version: 3, id: `TEST-${repeats}`, label: null, warmup: [], cooldown: [],
    main: [{ kind: "segment", role: "WORK", id: "work", label: null, repeatCount: repeats,
      work: { kind: "duration", durationSeconds: 13, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: null },
      recoveryBetweenRepeats: [{ mode: "WALK", distanceM: 100, seconds: null }, { mode: "STAND", seconds: 7 }],
      recoveryAfter: [{ mode: "STAND", seconds: 19 }] }],
  })
  const sequences = [sequence(6), sequence(4)]
  const refs = sequences.map((s, i) => configurationReferenceV3({ familyId: "TEST", configurationId: `TEST-${i}`, version: "1" }, s))
  const policy = { policyId: "TEST", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "TEST",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [{ from: refs[0]!, to: refs[1]! }] }
  return { refs, props: {
    authority: { catalog: [{ familyId: "TEST", reviewRef: "TEST_NOT_APPROVAL", configurations: sequences.map((s, i) => ({ configurationId: refs[i]!.configurationId, version: "1", sequence: s })) }], policies: [policy] },
    current: { configuration: refs[0]!, sequence: sequences[0]! }, policy: adjustmentPolicyReference(policy), contextKey: "TEST",
    choices: [{ configuration: refs[1]!, label: "시험 구성" }],
    orderedChoices: [{ dimension: "repetitions" as const, configurations: refs }],
    now: vi.fn(() => 150), onApply: vi.fn(), onCancel: vi.fn(),
  } }
}
const choose = () => fireEvent.click(screen.getByRole("radio", { name: "시험 구성" }))
const apply = () => fireEvent.click(screen.getByRole("button", { name: "변경안 적용" }))
const row = (name: string) => within(within(screen.getByRole("table", { name: "본운동 변경 전후 합계" }))
  .getByRole("rowheader", { name }).closest("tr")!).getAllByRole("cell").map(c => c.textContent)

describe("V3 adjustment editor", () => {
  it("keeps unknown recovery duration unknown and applies only an explicit reviewed configuration", async () => {
    const { props, refs } = fixture(), original = JSON.stringify(props.current)
    render(<PrescriptionAdjustmentEditorV3 {...props} />)
    expect(screen.getByRole("button", { name: "변경안 적용" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "반복 다음 구성" }))
    expect(row("본운동 시간")).toEqual(["78초", "52초", "-26초"])
    expect(row("회복 시간")).toEqual(["산출 불가", "산출 불가", "산출 불가"])
    expect(row("회복 거리")).toEqual(["500m", "300m", "-200m"])
    expect(props.onApply).not.toHaveBeenCalled()
    await act(async () => apply())
    expect(props.onApply).toHaveBeenCalledOnce()
    expect(props.onApply.mock.calls[0]![1].configuration).toEqual(refs[1])
    expect(JSON.stringify(props.current)).toBe(original)
  })

  it("discards only the draft and restores focus without applying", () => {
    const { props } = fixture()
    render(<button>열기</button>)
    const opener = screen.getByRole("button", { name: "열기" }); opener.focus()
    render(<PrescriptionAdjustmentEditorV3 {...props} />)
    choose()
    fireEvent.click(screen.getAllByRole("button", { name: "취소" })[0]!)
    expect(screen.getByRole("alertdialog")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "변경안 버리기" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
    expect(opener).toHaveFocus()
  })

  it("rejects expiration at apply even after a valid preview", () => {
    const { props } = fixture()
    render(<PrescriptionAdjustmentEditorV3 {...props} />)
    choose(); props.now.mockReturnValue(201); apply()
    expect(props.onApply).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("유효 시간이 지났어요")
  })

  it("rejects a removed choice and preserves a failed async draft for retry", async () => {
    const { props } = fixture()
    const onApply = vi.fn().mockRejectedValueOnce(Error("DO_NOT_EXPOSE")).mockResolvedValue(undefined)
    const view = render(<PrescriptionAdjustmentEditorV3 {...props} onApply={onApply} />)
    choose()
    view.rerender(<PrescriptionAdjustmentEditorV3 {...props} choices={[]} onApply={onApply} />)
    apply(); expect(onApply).not.toHaveBeenCalled()
    view.rerender(<PrescriptionAdjustmentEditorV3 {...props} onApply={onApply} />)
    await act(async () => apply())
    expect(screen.getByRole("alert")).not.toHaveTextContent("DO_NOT_EXPOSE")
    expect(screen.getByRole("radio", { name: "시험 구성" })).toBeChecked()
    await act(async () => apply())
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
