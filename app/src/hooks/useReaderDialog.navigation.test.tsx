import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useReaderDialog } from "./useReaderDialog"
import { JournalConfirmationDialog } from "../components/JournalConfirmationDialog"

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-origin" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks() })

function Reader({ close, confirmationClose }: { readonly close: () => void; readonly confirmationClose: () => void }) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const back = useReaderDialog(dialog, close)
  const [confirmation, setConfirmation] = React.useState(false)
  return <dialog ref={dialog}>
    <button onClick={back}>close reader</button>
    <button onClick={() => setConfirmation(true)}>open top confirmation</button>
    {confirmation && <JournalConfirmationDialog title="synthetic top" description="synthetic" confirmLabel="confirm"
      onConfirm={() => false} onCancel={() => { confirmationClose(); setConfirmation(false) }} />}
  </dialog>
}

describe("native reader with a confirmation above it", () => {
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
