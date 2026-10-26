import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useReaderDialog } from "./useReaderDialog"
import { JournalConfirmationDialog } from "../components/JournalConfirmationDialog"
import { beginBrowserPopNavigation, hasPendingBrowserBackLayer, registerBrowserBackLayer } from "../navigation/browserNavigation"

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks() })

function Reader({ close, confirmationClose, enabled = true, returnFocusTo }: { readonly close: () => void; readonly confirmationClose: () => void; readonly enabled?: boolean; readonly returnFocusTo?: () => HTMLElement | null }) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const back = useReaderDialog(dialog, close, returnFocusTo, enabled)
  const [confirmation, setConfirmation] = React.useState(false)
  return <dialog ref={dialog}>
    <button onClick={back}>close reader</button>
    <button onClick={() => setConfirmation(true)}>open top confirmation</button>
    {confirmation && <JournalConfirmationDialog title="synthetic top" description="synthetic" confirmLabel="confirm"
      onConfirm={() => false} onCancel={() => { confirmationClose(); setConfirmation(false) }} />}
  </dialog>
}

describe("native reader with a confirmation above it", () => {
  it("can close again after its Back consumed a child layer instead of the reader", () => {
    const close = vi.fn()
    render(<Reader close={close} confirmationClose={vi.fn()} />)
    const readerState = window.history.state
    fireEvent.click(screen.getByRole("button", { name: "open top confirmation" }))
    fireEvent.click(screen.getByRole("button", { name: "close reader" }))
    expect(window.history.back).toHaveBeenCalledTimes(1)
    window.history.replaceState(readerState, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: readerState }))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "close reader" }))
    expect(window.history.back).toHaveBeenCalledTimes(2)
    window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
    expect(close).toHaveBeenCalledOnce()
  })

  it.each(["inert", "hidden", "disabled"])("rejects a %s return target and restores the valid opener", kind => {
    const opener = document.createElement("button")
    document.body.append(opener)
    opener.focus()
    const target = document.createElement("button")
    const wrapper = document.createElement("div")
    wrapper.append(target)
    document.body.append(wrapper)
    if (kind === "disabled") target.disabled = true
    else wrapper.setAttribute(kind, "")
    const view = render(<Reader close={vi.fn()} confirmationClose={vi.fn()} returnFocusTo={() => target} />)
    screen.getByRole("button", { name: "close reader" }).focus()
    view.unmount()
    expect(opener).toHaveFocus()
    wrapper.remove(); opener.remove()
  })

  it("does not open a disabled reader, then waits for a queued result Back before its first opening", () => {
    const close = vi.fn(), show = vi.spyOn(HTMLDialogElement.prototype, "showModal")
    const view = render(<Reader close={close} confirmationClose={vi.fn()} enabled={false} />)
    expect(show).not.toHaveBeenCalled()
    expect(window.history.state).toEqual({ parent: "synthetic-origin" })
    const result = registerBrowserBackLayer({ id: "synthetic-reader-save-result", canClose: () => true, onClose: vi.fn() })
    result.close()
    expect(hasPendingBrowserBackLayer()).toBe(true)
    view.rerender(<Reader close={close} confirmationClose={vi.fn()} />)
    expect(show).not.toHaveBeenCalled()
    expect(window.history.state.trainoracleReader).toBeUndefined()
    expect(close).not.toHaveBeenCalled()
    window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
    expect(hasPendingBrowserBackLayer()).toBe(false)
    act(() => { beginBrowserPopNavigation() })
    expect(show).toHaveBeenCalledTimes(1)
    expect(window.history.state.trainoracleReader).toEqual(expect.any(String))
    expect(close).not.toHaveBeenCalled()
  })

  it("keeps a single reader history entry under the StrictMode effect replay", () => {
    const push = vi.spyOn(window.history, "pushState"), close = vi.fn()
    render(<React.StrictMode><Reader close={close} confirmationClose={vi.fn()} /></React.StrictMode>)
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.history.state.trainoracleReader).toEqual(expect.any(String))
    expect(close).not.toHaveBeenCalled()
  })

  it("suspends and resumes an open reader without stealing result focus or adding another reader entry", () => {
    const close = vi.fn(), show = vi.spyOn(HTMLDialogElement.prototype, "showModal")
    const push = vi.spyOn(window.history, "pushState")
    const fixture = (enabled: boolean) => <><button type="button">synthetic result focus</button>
      <Reader close={close} confirmationClose={vi.fn()} enabled={enabled} /></>
    const view = render(fixture(true))
    const readerId = window.history.state.trainoracleReader
    expect(push).toHaveBeenCalledTimes(1)
    const resultFocus = screen.getByRole("button", { name: "synthetic result focus" })
    resultFocus.focus()
    view.rerender(fixture(false))
    expect(resultFocus).toHaveFocus()
    expect(document.querySelector("dialog")).not.toHaveAttribute("open")
    expect(window.history.state).toEqual({ parent: "synthetic-origin" })
    const result = registerBrowserBackLayer({ id: "synthetic-reader-resume-result", canClose: () => true, onClose: vi.fn() })
    result.close()
    view.rerender(fixture(true))
    expect(show).toHaveBeenCalledTimes(1)
    window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
    act(() => { beginBrowserPopNavigation() })
    expect(show).toHaveBeenCalledTimes(2)
    expect(window.history.state).toEqual({ parent: "synthetic-origin", trainoracleReader: readerId })
    // One original reader push and one temporary result push, not a second reader.
    expect(push).toHaveBeenCalledTimes(2)
    expect(close).not.toHaveBeenCalled()
  })

  it("does not close a lower reader for a claimed confirmation POP, then still closes for its own Back", () => {
    const readerClose = vi.fn(), confirmationClose = vi.fn()
    render(<Reader close={readerClose} confirmationClose={confirmationClose} />)
    fireEvent.click(screen.getByRole("button", { name: "open top confirmation" }))
    // An entry below the reader can be visited by history.go(-2). The top
    // confirmation owns this first event; lower native listeners must not act.
    window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: { parent: "synthetic-origin" } }))
    expect(confirmationClose).toHaveBeenCalledOnce()
    expect(readerClose).not.toHaveBeenCalled()
    fireEvent(window, new PopStateEvent("popstate", { state: null }))
    expect(readerClose).toHaveBeenCalledOnce()
  })

  it("keeps the normal reader button Back without calling its close callback prematurely", () => {
    const readerClose = vi.fn()
    render(<Reader close={readerClose} confirmationClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "close reader" }))
    expect(window.history.back).toHaveBeenCalledOnce()
    expect(readerClose).not.toHaveBeenCalled()
    window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: { parent: "synthetic-origin" } }))
    expect(readerClose).toHaveBeenCalledOnce()
  })
})
