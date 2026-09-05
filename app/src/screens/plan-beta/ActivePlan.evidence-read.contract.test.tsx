import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const scrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo")
beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  for (const [prototype, key, descriptor] of [[HTMLDialogElement.prototype, "showModal", showModal], [Element.prototype, "scrollTo", scrollTo]] as const) {
    if (descriptor) Object.defineProperty(prototype, key, descriptor)
    else Reflect.deleteProperty(prototype, key)
  }
})

it.each([null, "[]", "{broken", '[{"invalid":"entry"}]'])
  ("preserves complete versus unavailable journal evidence for %s", async raw => {
    if (raw !== null) localStorage.setItem("trainoracle.journal.v1", raw)
    render(<ActivePlan state={stateFixture()} onProgress={vi.fn()} onNextFrame={vi.fn()}
      onActivateNextFrame={vi.fn()} onCheckDetailedExecution={vi.fn()} />)
    await userEvent.click(screen.getAllByRole("button", { name: "훈련 방법과 이유" })[0]!)
    await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
    const complete = raw === null || raw === "[]"
    expect(screen.queryByText(/이 훈련과 연결된 일지가 아직 없어요/u) !== null).toBe(complete)
    expect(screen.queryByText(/조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요/u) !== null).toBe(!complete)
    expect(localStorage.getItem("trainoracle.journal.v1")).toBe(raw)
  })

it("does not turn a storage exception into an empty journal", async () => {
  const original = Storage.prototype.getItem
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === "trainoracle.journal.v1") throw new Error("synthetic storage failure")
    return original.call(this, key)
  })
  render(<ActivePlan state={stateFixture()} onProgress={vi.fn()} onNextFrame={vi.fn()}
    onActivateNextFrame={vi.fn()} onCheckDetailedExecution={vi.fn()} />)
  await userEvent.click(screen.getAllByRole("button", { name: "훈련 방법과 이유" })[0]!)
  await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
  expect(screen.getByText(/조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요/u)).toBeVisible()
  expect(screen.queryByText(/이 훈련과 연결된 일지가 아직 없어요/u)).toBeNull()
})
