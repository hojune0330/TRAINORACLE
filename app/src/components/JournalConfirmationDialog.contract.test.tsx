import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { JournalConfirmationDialog } from "./JournalConfirmationDialog"

afterEach(cleanup)

function DialogHarness({
  onConfirm,
  onCancel,
}: {
  readonly onConfirm: () => boolean
  readonly onCancel: () => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" data-testid="dialog-trigger" onClick={() => setOpen(true)}>open</button>
      {open && (
        <JournalConfirmationDialog
          title="title"
          description="description"
          confirmLabel="confirm"
          onCancel={() => {
            onCancel()
            setOpen(false)
          }}
          onConfirm={onConfirm}
        />
      )}
    </>
  )
}

describe("JournalConfirmationDialog", () => {
  it("keeps keyboard focus inside and returns it after Escape", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DialogHarness onCancel={vi.fn()} onConfirm={() => true} />)
    const trigger = screen.getByTestId("dialog-trigger")

    await user.click(trigger)

    const cancel = screen.getByTestId("journal-delete-cancel")
    const confirm = screen.getByTestId("journal-delete-confirm")
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()

    rerender(<DialogHarness onCancel={vi.fn()} onConfirm={() => true} />)
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(cancel).toHaveFocus()

    await user.keyboard("{Escape}")
    expect(screen.queryByTestId("journal-delete-dialog")).toBeNull()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("cancels from the backdrop without confirming", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<DialogHarness onCancel={onCancel} onConfirm={() => {
      onConfirm()
      return true
    }} />)
    await user.click(screen.getByTestId("dialog-trigger"))

    fireEvent.click(screen.getByTestId("journal-delete-dialog"))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("runs the destructive action only from its explicit button", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DialogHarness onCancel={vi.fn()} onConfirm={() => {
      onConfirm()
      return true
    }} />)
    await user.click(screen.getByTestId("dialog-trigger"))

    await user.click(screen.getByTestId("journal-delete-confirm"))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
