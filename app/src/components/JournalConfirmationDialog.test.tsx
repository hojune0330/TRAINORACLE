import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { JournalConfirmationDialog } from "./JournalConfirmationDialog"

afterEach(cleanup)

it("keeps an in-flight request open and rejects duplicate confirmation", async () => {
  let finish!: (value: boolean) => void
  const confirm = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
  const cancel = vi.fn()
  render(<JournalConfirmationDialog title="삭제 확인" description="시험 기록" confirmLabel="삭제" onCancel={cancel} onConfirm={confirm} />)
  fireEvent.click(screen.getByRole("button", { name: "삭제" }))
  fireEvent.click(screen.getByRole("button", { name: "삭제" }))
  fireEvent.keyDown(document, { key: "Escape" })
  fireEvent.click(screen.getByRole("alertdialog"))
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(cancel).not.toHaveBeenCalled()
  await act(async () => { finish(false) })
  fireEvent.keyDown(document, { key: "Escape" })
  expect(cancel).toHaveBeenCalledTimes(1)
})

it("reports rejected requests without an unhandled promise or false completion", async () => {
  const confirm = vi.fn().mockRejectedValue(new Error("synthetic failure"))
  render(<JournalConfirmationDialog title="삭제 확인" description="시험 기록" confirmLabel="삭제" onCancel={vi.fn()} onConfirm={confirm} />)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "삭제" })) })
  expect(screen.getByRole("alert").textContent).toContain("처리하지 못했어요")
  expect(screen.getByRole("alert").textContent).not.toContain("synthetic")
  expect((screen.getByRole("button", { name: "삭제" }) as HTMLButtonElement).disabled).toBe(false)
})
