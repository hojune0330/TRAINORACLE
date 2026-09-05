import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adjustmentPolicyReference, configurationReference } from "@impl/prescription/prescription-adjustment"
import type { AdjustmentAuthority, PrescriptionSnapshot, ReviewedAdjustmentPolicy } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceRecovery } from "@impl/prescription/sequence"
import { PrescriptionAdjustmentEditor } from "./PrescriptionAdjustmentEditor"
import type { PrescriptionAdjustmentEditorProps } from "./PrescriptionAdjustmentEditor"

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value: function (this: HTMLDialogElement) { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup()
  for (const [key, descriptor] of [["showModal", originalShowModal], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
  document.body.style.overflow = ""
  vi.restoreAllMocks()
})

// Arithmetic-only synthetic registry. No real athlete, approved dose or production manifest.
const none = { mode: "NOT_APPLICABLE", seconds: null } as const
const rest = (seconds: number): SequenceRecovery => ({ mode: "STAND", seconds })
function segment(count = 6, durationSeconds: number | null = 13): PrescriptionSequenceNode {
  return { kind: "segment", id: "synthetic-work", label: "시험 구간", repeatCount: count,
    recoveryBetweenRepeats: rest(7), recoveryAfter: rest(999),
    work: { kind: "duration", durationSeconds, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: null } }
}
function sequence(main: readonly PrescriptionSequenceNode[], terminalRecovery: SequenceRecovery = none): PrescriptionSequence {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "synthetic-sequence", label: null,
    warmup: [{ ...segment(1, 100), id: "synthetic-warmup" }], main,
    cooldown: [{ ...segment(1, 200), id: "synthetic-cooldown" }], terminalRecovery }
}
function fixture(beforeSequence = sequence([segment()]), afterSequence = sequence([{
  kind: "group", id: "synthetic-sets", label: "시험 세트", repeatCount: 2,
  recoveryBetweenRepeats: rest(19), recoveryAfter: rest(999), children: [segment(3)],
}])) {
  const familyId = "synthetic-family"
  const sequences = [beforeSequence, afterSequence, sequence([segment(2, 17)])]
  const refs = sequences.map((value, index) => configurationReference({ familyId, configurationId: `test-${index}`, version: "1" }, value))
  const current: PrescriptionSnapshot = { configuration: refs[0]!, sequence: beforeSequence }
  const reviewed: ReviewedAdjustmentPolicy = {
    policyId: "synthetic-policy", version: "1", reviewRef: "TEST-ONLY-NOT-APPROVAL", contextKey: "synthetic-context",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: refs.slice(1).map(to => ({ from: current.configuration, to })),
  }
  const authority: AdjustmentAuthority = {
    catalog: [{ familyId, reviewRef: "TEST-ONLY-NOT-APPROVAL", configurations: sequences.map((value, index) => ({ configurationId: `test-${index}`, version: "1", sequence: value })) }],
    policies: [reviewed],
  }
  const props: PrescriptionAdjustmentEditorProps = {
    authority, policy: adjustmentPolicyReference(reviewed), contextKey: reviewed.contextKey, current,
    choices: [{ label: "시험 구성 A", configuration: refs[1]! }, { label: "시험 구성 B", configuration: refs[2]! }],
    now: vi.fn(() => 150), onApply: vi.fn(), onCancel: vi.fn(),
  }
  return { props, reviewed, refs, sequences }
}
const chooseA = () => userEvent.click(screen.getByRole("radio", { name: "시험 구성 A" }))
const applyButton = () => screen.getByRole("button", { name: "적용" })
const cancelButton = () => screen.getAllByRole("button", { name: "취소" }).at(-1)!
function escape() {
  const event = new Event("cancel", { bubbles: false, cancelable: true })
  fireEvent(screen.getByRole(screen.queryByRole("alertdialog") ? "alertdialog" : "dialog"), event)
  expect(event.defaultPrevented).toBe(true)
}
function row(label: string, table = "변경 전후 합계") {
  const element = within(screen.getByRole("table", { name: table })).getByRole("rowheader", { name: label }).closest("tr")!
  return within(element).getAllByRole("cell").map(cell => cell.textContent)
}

describe("prepared reviewed prescription adjustment editor", () => {
  it("opens a native modal, makes no draft/save by default and restores focus/scroll on clean Escape", () => {
    const { props } = fixture()
    render(<button>편집 열기</button>)
    const opener = screen.getByRole("button", { name: "편집 열기" })
    opener.focus()
    document.body.style.overflow = "auto"
    render(<PrescriptionAdjustmentEditor {...props} />)
    expect(screen.getByRole("dialog", { name: "처방 조정" })).toHaveAttribute("open")
    expect(screen.getAllByRole("button", { name: "취소" })[0]).toHaveFocus()
    expect(applyButton()).toBeDisabled()
    expect(screen.getByRole("radio", { name: "현재 구성" })).toBeChecked()
    escape()
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe("auto")
  })

  it("keeps a dirty draft through discard dismissal, then cancels without changing current", async () => {
    const { props } = fixture()
    const original = JSON.stringify(props.current)
    render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    escape()
    expect(screen.getByRole("alertdialog", { name: "변경안을 버릴까요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "계속 수정" })).toHaveFocus()
    expect(props.onCancel).not.toHaveBeenCalled()
    escape()
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(screen.getAllByRole("button", { name: "취소" })[0]).toHaveFocus()
    await userEvent.click(cancelButton())
    await userEvent.click(screen.getByRole("button", { name: "계속 수정" }))
    await userEvent.click(cancelButton())
    await userEvent.click(screen.getByRole("button", { name: "변경안 버리기" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
    expect(JSON.stringify(props.current)).toBe(original)
  })

  it("resets only pending intent, including choosing the current radio, without applying an inverse edge", async () => {
    const { props } = fixture()
    render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    expect(row("본운동과 회복 시간")).toEqual(["113초", "125초", "+12초"])
    await userEvent.click(screen.getByRole("button", { name: "변경안 초기화" }))
    expect(row("본운동과 회복 시간")).toEqual(["113초", "113초", "0초"])
    expect(applyButton()).toBeDisabled()
    await chooseA()
    await userEvent.click(screen.getByRole("radio", { name: "현재 구성" }))
    expect(applyButton()).toBeDisabled()
    await userEvent.click(cancelButton())
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(props.onApply).not.toHaveBeenCalled()
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it("previews exact nested recovery boundaries and awaits one explicit async apply receipt", async () => {
    const { props, refs } = fixture()
    let finish!: () => void
    const onApply = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const source = JSON.stringify({ current: props.current, authority: props.authority })
    render(<PrescriptionAdjustmentEditor {...props} onApply={onApply} />)
    await chooseA()
    expect(onApply).not.toHaveBeenCalled()
    expect(row("본운동 반복")).toEqual(["6회", "6회", "0회"])
    expect(row("본운동 시간")).toEqual(["78초", "78초", "0초"])
    expect(row("회복 시간 합계")).toEqual(["35초", "47초", "+12초"])
    await userEvent.click(screen.getByText("회복 구간별 합계"))
    expect(row("반복 사이 회복 횟수", "변경 전후 회복 구간")).toEqual(["5회", "4회", "-1회"])
    expect(row("세트 사이 회복 시간", "변경 전후 회복 구간")).toEqual(["0초", "19초", "+19초"])
    await userEvent.dblClick(applyButton())
    expect(onApply).toHaveBeenCalledOnce()
    const [receipt, prescription] = onApply.mock.calls[0]! as unknown as Parameters<PrescriptionAdjustmentEditorProps["onApply"]>
    expect(receipt).toMatchObject({ action: "USER_EXPLICIT", appliedAtMs: 150, contextKey: props.contextKey,
      before: props.current, after: prescription, delta: { mainSessionTotalExcludingWarmupCooldown: 12 } })
    expect(prescription.configuration).toEqual(refs[1])
    expect(screen.getByRole("button", { name: "적용 중" })).toBeDisabled()
    expect(cancelButton()).toBeDisabled()
    expect(screen.getByRole("button", { name: "변경안 초기화" })).toBeDisabled()
    escape()
    expect(props.onCancel).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(JSON.stringify({ current: props.current, authority: props.authority })).toBe(source)
  })

  it("preserves the draft on async apply rejection and can retry after owner verification", async () => {
    const { props } = fixture()
    const onApply = vi.fn().mockRejectedValueOnce(new Error("PRIVATE-DO-NOT-SHOW")).mockResolvedValue(undefined)
    render(<PrescriptionAdjustmentEditor {...props} onApply={onApply} />)
    await chooseA()
    await userEvent.click(applyButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("변경안을 적용하지 못했어요")
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(document.body).not.toHaveTextContent("PRIVATE-DO-NOT-SHOW")
    await userEvent.click(applyButton())
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("rechecks the clock at Apply, rejects exact expiry and preserves the preview and reset", async () => {
    const { props } = fixture()
    let now = 150
    render(<PrescriptionAdjustmentEditor {...props} now={() => now} />)
    await chooseA()
    now = 200
    await userEvent.click(applyButton())
    expect(screen.getByRole("alert")).toHaveTextContent("유효 시간")
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(row("본운동과 회복 시간")).toEqual(["113초", "125초", "+12초"])
    expect(props.onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "변경안 초기화" }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(applyButton()).toBeDisabled()
  })

  it("rejects a recomputed forged configuration ref without discarding the previous valid draft", async () => {
    const { props, refs } = fixture()
    const forged = configurationReference(refs[2]!, sequence([segment(99)]))
    render(<PrescriptionAdjustmentEditor {...props} choices={[...props.choices, { label: "위조 구성", configuration: forged }]} />)
    await chooseA()
    await userEvent.click(screen.getByRole("radio", { name: "위조 구성" }))
    expect(screen.getByRole("alert")).toHaveTextContent("일치하지 않아요")
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "위조 구성" })).not.toBeChecked()
    await userEvent.click(applyButton())
    expect(props.onApply).toHaveBeenCalledOnce()
    expect(vi.mocked(props.onApply).mock.calls[0]![1].configuration).toEqual(refs[1])
  })

  it.each(["withdrawn policy", "changed catalog"])("revalidates %s at Apply against the live trusted authority", async mode => {
    const { props } = fixture()
    const view = render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    const authority: AdjustmentAuthority = mode === "withdrawn policy" ? { ...props.authority, policies: [] }
      : { ...props.authority, catalog: [{ ...props.authority.catalog[0]!, configurations: [{ configurationId: "test-0", version: "1", sequence: sequence([segment(99)]) }] }] }
    view.rerender(<PrescriptionAdjustmentEditor {...props} authority={authority} />)
    await userEvent.click(applyButton())
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it.each(["current", "context", "policy"])("rejects a changed %s without silently replacing edits, even after a prop round trip", async kind => {
    const { props, refs, sequences, reviewed } = fixture()
    const view = render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    const changed = kind === "current" ? { current: { configuration: refs[2]!, sequence: sequences[2]! } }
      : kind === "context" ? { contextKey: "other-synthetic-session" }
        : { policy: adjustmentPolicyReference({ ...reviewed, expiresAtMs: 300 }) }
    view.rerender(<PrescriptionAdjustmentEditor {...props} {...changed} />)
    expect(screen.getByRole("alert")).toBeVisible()
    expect(applyButton()).toBeDisabled()
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    expect(row("본운동과 회복 시간")).toEqual(["113초", "125초", "+12초"])
    view.rerender(<PrescriptionAdjustmentEditor {...props} />)
    expect(applyButton()).toBeDisabled()
    fireEvent.click(applyButton())
    expect(props.onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "변경안 초기화" }))
    expect(applyButton()).toBeDisabled()
    expect(screen.getByRole("radio", { name: "현재 구성" })).toBeChecked()
  })

  it("detects current mutation during click-time evaluation rather than trusting render-time state", async () => {
    const { props, sequences } = fixture()
    let mutate = false
    render(<PrescriptionAdjustmentEditor {...props} now={() => {
      if (mutate) Object.assign(props.current, { sequence: sequences[2] })
      return 150
    }} />)
    await chooseA()
    mutate = true
    await userEvent.click(applyButton())
    expect(screen.getByRole("alert")).toHaveTextContent("현재 처방이 바뀌었어요")
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it("rejects a removed UI choice at Apply without substituting another configuration", async () => {
    const { props } = fixture()
    const view = render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    view.rerender(<PrescriptionAdjustmentEditor {...props} choices={props.choices.slice(1)} />)
    await userEvent.click(applyButton())
    expect(screen.getByRole("alert")).toHaveTextContent("일치하지 않아요")
    expect(row("본운동과 회복 시간")).toEqual(["113초", "125초", "+12초"])
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it("moves only along explicitly supplied ordered refs, disables endpoints and never generates arithmetic doses", async () => {
    const { props, refs } = fixture()
    render(<PrescriptionAdjustmentEditor {...props} orderedChoices={[
      { dimension: "repetitions", configurations: refs },
      { dimension: "recovery", configurations: [refs[2]!, refs[1]!] },
      { dimension: "time", configurations: [refs[0]!, { ...refs[1]!, configurationId: "missing" }] },
    ]} />)
    expect(screen.getByRole("button", { name: "반복 이전 구성" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "회복 다음 구성" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "시간 다음 구성" })).toBeDisabled()
    expect(screen.queryByRole("spinbutton")).toBeNull()
    expect(screen.queryByRole("slider")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "반복 다음 구성" }))
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "반복 다음 구성" }))
    expect(screen.getByRole("radio", { name: "시험 구성 B" })).toBeChecked()
    expect(screen.getByRole("button", { name: "반복 다음 구성" })).toBeDisabled()
    expect(row("본운동 시간")).toEqual(["78초", "34초", "-44초"])
    await userEvent.click(screen.getByRole("button", { name: "회복 다음 구성" }))
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "반복 이전 구성" }))
    expect(screen.getByRole("radio", { name: "현재 구성" })).toBeChecked()
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it("preserves unknown time and exact distance/terminal recovery without exposing private refs or JSON", async () => {
    const roll = { mode: "ACTIVE_ROLL_ON", distanceM: 17, seconds: null } as const
    const work: PrescriptionSequenceNode = { ...segment(3), kind: "segment", work: { kind: "distance", distanceM: 111, durationSeconds: null }, target: { kind: "EFFORT_GUIDANCE", cue: null }, recoveryBetweenRepeats: roll }
    const { props } = fixture(sequence([work]), sequence([work], roll))
    render(<PrescriptionAdjustmentEditor {...props} />)
    await chooseA()
    expect(row("본운동 거리")).toEqual(["333m", "333m", "0m"])
    expect(row("회복 거리 합계")).toEqual(["34m", "51m", "+17m"])
    for (const metric of ["본운동 시간", "회복 시간 합계", "본운동과 회복 시간"]) {
      expect(row(metric)).toEqual(["산출 불가", "산출 불가", "산출 불가"])
    }
    await userEvent.click(screen.getByText("회복 구간별 합계"))
    expect(row("마지막 회복 횟수", "변경 전후 회복 구간")).toEqual(["0회", "1회", "+1회"])
    await userEvent.click(screen.getByText("변경안 수행 순서"))
    expect(screen.getByText(/마지막 본운동 뒤/)).toHaveTextContent("17m 속도를 낮춰 이어 달리기")
    expect(document.body).not.toHaveTextContent("contentIdentity")
    expect(document.body).not.toHaveTextContent(props.contextKey)
    expect(document.body).not.toHaveTextContent(props.current.configuration.contentIdentity)
    expect(document.body).not.toHaveTextContent("17초")
  })

  it("does not invent unavailable work distance or time, or supply choices/policies by default", async () => {
    const { props } = fixture(sequence([segment(3, null)]), sequence([segment(4, null)]))
    const view = render(<PrescriptionAdjustmentEditor {...props} choices={[]} authority={{ catalog: [], policies: [] }} />)
    expect(screen.getByText("검토된 변경 구성이 없어요.")).toBeVisible()
    expect(screen.getAllByRole("radio")).toHaveLength(1)
    expect(applyButton()).toBeDisabled()
    expect(row("본운동 거리")).toEqual(["산출 불가", "산출 불가", "산출 불가"])
    view.rerender(<PrescriptionAdjustmentEditor {...props} authority={{ ...props.authority, policies: [] }} />)
    await chooseA()
    expect(screen.getByRole("alert")).toBeVisible()
    expect(applyButton()).toBeDisabled()
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it("keeps the draft when the time source throws and restores focus on forced unmount", async () => {
    const { props } = fixture()
    let fail = false
    render(<button>열기</button>)
    const opener = screen.getByRole("button", { name: "열기" })
    opener.focus()
    const view = render(<React.StrictMode><PrescriptionAdjustmentEditor {...props} now={() => { if (fail) throw new Error("secret"); return 150 }} /></React.StrictMode>)
    await chooseA()
    fail = true
    await userEvent.click(applyButton())
    expect(screen.getByRole("alert")).toHaveTextContent("변경안을 유지했으니")
    expect(screen.getByRole("radio", { name: "시험 구성 A" })).toBeChecked()
    view.unmount()
    await waitFor(() => expect(opener).toHaveFocus())
    expect(props.onApply).not.toHaveBeenCalled()
    expect(props.onCancel).not.toHaveBeenCalled()
  })
})
