import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustmentCommitFixture } from "../../domain/prescription-adjustment-commit.test-fixtures"
import { PrescriptionAdjustmentCommitHost } from "./PrescriptionAdjustmentCommitHost"

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup()
  for (const [key, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})

function setup() {
  const f = adjustmentCommitFixture()
  const props = { authority: f.authority, policy: f.policy, contextKey: f.base.contextKey,
    base: f.base, adapter: f.adapter, now: f.adapter.now,
    choices: [{ label: "시험용 변경 구성", configuration: f.refs[1]! }],
    onCommitted: vi.fn(), onCancel: vi.fn() }
  return { f, props }
}

const choose = () => fireEvent.click(screen.getByRole("radio", { name: "시험용 변경 구성" }))
const apply = () => fireEvent.click(screen.getByRole("button", { name: "적용" }))

it("connects explicit editor Apply to one number/explanation/receipt commit", async () => {
  const { f, props } = setup()
  render(<PrescriptionAdjustmentCommitHost {...props} />)
  choose()
  expect(f.writes()).toBe(0)
  apply()
  await waitFor(() => expect(props.onCommitted).toHaveBeenCalledOnce())
  expect(f.adapter.readState().prescription).toEqual(f.applied.prescription)
  expect(f.adapter.readState().explanation.explanationVersion).toBe("test-1")
  expect(f.writes()).toBe(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("discards without any candidate commit", () => {
  const { f, props } = setup()
  render(<PrescriptionAdjustmentCommitHost {...props} />)
  choose()
  fireEvent.click(screen.getAllByRole("button", { name: "취소" })[0]!)
  fireEvent.click(screen.getByRole("button", { name: "변경안 버리기" }))
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onCommitted).not.toHaveBeenCalled()
  expect(f.adapter.readState()).toEqual(f.base)
})

it("keeps the draft after failed CAS and retries the same exact change", async () => {
  const { f, props } = setup()
  let writable = false
  const adapter = { ...f.adapter, compareAndSwap: (...args: Parameters<typeof f.adapter.compareAndSwap>) => writable && f.adapter.compareAndSwap(...args) }
  render(<PrescriptionAdjustmentCommitHost {...props} adapter={adapter} />)
  choose()
  apply()
  await screen.findByText(/변경안을 적용하지 못했어요/u)
  expect(f.writes()).toBe(0)
  expect(screen.getByRole("radio", { name: "시험용 변경 구성" })).toBeChecked()
  writable = true
  apply()
  await waitFor(() => expect(props.onCommitted).toHaveBeenCalledOnce())
  expect(f.writes()).toBe(1)
})

it("does not adopt a new base revision while an old editor remains open", async () => {
  const { f, props } = setup()
  const view = render(<PrescriptionAdjustmentCommitHost {...props} />)
  choose()
  const changed = { ...f.base, revision: "different-candidate-revision" }
  f.setState(changed)
  view.rerender(<PrescriptionAdjustmentCommitHost {...props} base={changed} />)
  apply()
  await screen.findByText(/변경안을 적용하지 못했어요/u)
  expect(f.writes()).toBe(0)
  expect(props.onCommitted).not.toHaveBeenCalled()
})

it("abandons an outstanding write when the editor unmounts", async () => {
  const { f, props } = setup()
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const write = vi.fn(async (...args: Parameters<typeof f.adapter.compareAndSwap>) => {
    await wait
    return f.adapter.compareAndSwap(...args)
  })
  const view = render(<PrescriptionAdjustmentCommitHost {...props} adapter={{ ...f.adapter, compareAndSwap: write }} />)
  choose()
  apply()
  await waitFor(() => expect(write).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { release(); await wait })
  expect(f.writes()).toBe(0)
  expect(props.onCommitted).not.toHaveBeenCalled()
})
