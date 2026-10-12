import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTaskFlowBack } from "./useTaskFlowBack"
import { beginBrowserPopNavigation, consumeBrowserBackLayer, registerBrowserBackLayer } from "../navigation/browserNavigation"

const account = vi.hoisted(() => ({ generation: 0 }))
vi.mock("../domain/account/local-journal-ownership", () => ({ localJournalScopeGeneration: () => account.generation }))
const parent = { syntheticFlowOrigin: true }
function popTo(state: unknown) {
  window.history.replaceState(state, "", window.location.href)
  beginBrowserPopNavigation()
  return consumeBrowserBackLayer(new PopStateEvent("popstate", { state }))
}
beforeEach(() => {
  account.generation = 0
  window.history.replaceState(parent, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
  vi.spyOn(window.history, "forward").mockImplementation(() => undefined)
})
afterEach(async () => {
  cleanup()
  await Promise.resolve()
  act(() => { popTo(parent) })
  vi.restoreAllMocks()
})

function Flow({ busy = false, initial = 0, onBack = () => {} }: { busy?: boolean; initial?: number; onBack?: () => void }) {
  const [step, setStep] = React.useState(initial)
  const [answer, setAnswer] = React.useState("")
  useTaskFlowBack({ enabled: step > 0, busy, onBack: () => { onBack(); setStep(value => value - 1) } })
  return <><h1>질문 {step}</h1><label>합성 답<input value={answer} onChange={event => setAnswer(event.target.value)} /></label>
    <button onClick={() => setStep(value => value + 1)}>다음</button></>
}

describe("task-flow native Back adapter", () => {
  it("steps backward once per Back without losing answers or leaving a sentinel on the first question", () => {
    const back = vi.fn(), push = vi.spyOn(window.history, "pushState")
    render(<React.StrictMode><Flow onBack={back} /></React.StrictMode>)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "보존할 합성 답" } })
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(push).toHaveBeenCalledTimes(1)
    act(() => { expect(popTo(parent)).toBe(true) })
    expect(screen.getByRole("heading")).toHaveTextContent("질문 1")
    expect(back).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(2)
    act(() => { expect(popTo(parent)).toBe(true) })
    expect(screen.getByRole("heading")).toHaveTextContent("질문 0")
    expect(back).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("textbox")).toHaveValue("보존할 합성 답")
    expect(window.history.state).toEqual(parent)
    act(() => { expect(popTo(null)).toBe(false) })
  })

  it("does not register above an open confirmation when a parent answer changes", () => {
    const push = vi.spyOn(window.history, "pushState"), close = vi.fn()
    render(<Flow initial={1} />)
    const flowState = window.history.state
    const dialog = registerBrowserBackLayer({ id: "synthetic-flow-dialog", canClose: () => true, onClose: close })
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(push).toHaveBeenCalledTimes(2)
    act(() => { expect(popTo(flowState)).toBe(true) })
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("heading")).toHaveTextContent("질문 2")
    act(() => { expect(popTo(parent)).toBe(true) })
    expect(screen.getByRole("heading")).toHaveTextContent("질문 1")
    dialog.dispose()
  })

  it("waits during save and ignores callbacks from an old account scope", () => {
    const back = vi.fn()
    const view = render(<Flow initial={1} busy onBack={back} />)
    const flowState = window.history.state
    act(() => { popTo(parent) })
    expect(window.history.forward).toHaveBeenCalledTimes(1)
    expect(back).not.toHaveBeenCalled()
    act(() => { popTo(flowState) })
    view.rerender(<Flow initial={1} onBack={back} />)
    account.generation += 1
    act(() => { popTo(parent) })
    expect(back).not.toHaveBeenCalled()
  })
})
