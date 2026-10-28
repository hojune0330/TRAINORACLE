import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { FormInputDraftBoundary, useFormInputDraft } from "./useFormInputDraft"
import { decodeFormDraft, type FormInput } from "./form-input-draft"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

const state = vi.hoisted(() => ({ view: null as any, sequence: 0, delay: null as (() => Promise<void>) | null, fail: false }))
vi.mock("../../domain/account/account-journal-api", () => ({ accountJournalPreviewEnabled: () => true, requestAccountJournal: async () => ({ ok: false, code: "NOT_FOUND" }) }))
vi.mock("../../domain/account/account-journal-sync", () => ({ flushAccountJournalDraft: async () => "SAVED" }))
vi.mock("./form-input-recovery", () => ({ createFormRecoveryCoordinator: () => ({ list: async () => [], close: () => {}, logout: () => {} }) }))
vi.mock("./form-input-draft", async original => ({
  ...await original<typeof import("./form-input-draft")>(),
  formDraftDocumentId: async () => "22222222-2222-4222-8222-222222222222",
  createFormDraftBuffer: () => ({
    read: async () => state.view,
    async saveDraft(_owner: string, _doc: string, draft: unknown) {
      const body = JSON.parse((draft as { body: string }).body)
      if (body.completed && state.delay) await state.delay()
      if (body.completed && state.fail) throw Error("synthetic completion write failure")
      state.view = { draft, localSequence: ++state.sequence, state: "DRAFT_LOCAL", blocked: null }
    },
    close: () => {}, logout: () => {},
  }),
}))

const OWNER = "11111111-1111-4111-8111-111111111111"
beforeEach(() => { state.view = null; state.sequence = 0; state.delay = null; state.fail = false; setActiveLocalAccount(OWNER) })
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })
function Harness() {
  const [memo, setMemo] = React.useState("")
  const [result, setResult] = React.useState("")
  const input: FormInput = { kind: "evening", sleep: 0, quality: 0, mood: 0, painParts: {}, weight: "", hr: "", memo, purpose: null }
  const draft = useFormInputDraft(input, "33333333-3333-4333-8333-333333333333")
  return <><input aria-label="synthetic memo" value={memo} onChange={event => setMemo(event.target.value)} />
    <button onClick={() => { void draft.complete(JSON.stringify(input)).then(value => setResult(String(value))) }}>complete submitted</button>
    <output aria-label="completion result">{result}</output></>
}
function mount() { render(<FormInputDraftBoundary kind="evening" date="2026-10-27" identity="synthetic"><Harness /></FormInputDraftBoundary>) }

it("does not mark newer input complete while an older completion write awaits storage", async () => {
  let release!: () => void
  state.delay = () => new Promise<void>(resolve => { release = resolve })
  mount()
  const field = await screen.findByRole("textbox", { name: "synthetic memo" })
  fireEvent.change(field, { target: { value: "SYNTHETIC_SUBMITTED" } })
  await waitFor(() => expect(decodeFormDraft(state.view?.draft).input).toMatchObject({ memo: "SYNTHETIC_SUBMITTED" }))
  fireEvent.click(screen.getByRole("button", { name: "complete submitted" }))
  await waitFor(() => expect(release).toBeTypeOf("function"))
  fireEvent.change(field, { target: { value: "SYNTHETIC_NEWER_UNFINISHED" } })
  await act(async () => { release(); await Promise.resolve() })
  await waitFor(() => expect(screen.getByLabelText("completion result")).toHaveTextContent("false"))
  expect(decodeFormDraft(state.view.draft)).toMatchObject({ completed: false, input: { memo: "SYNTHETIC_NEWER_UNFINISHED" } })
  expect(field).toHaveValue("SYNTHETIC_NEWER_UNFINISHED")
})

it("reports cleanup failure and retries the same snapshot without inventing a new draft identity", async () => {
  state.fail = true
  mount()
  const field = await screen.findByRole("textbox", { name: "synthetic memo" })
  fireEvent.change(field, { target: { value: "SYNTHETIC_RETRY" } })
  await waitFor(() => expect(state.view).not.toBeNull())
  fireEvent.click(screen.getByRole("button", { name: "complete submitted" }))
  await waitFor(() => expect(screen.getByLabelText("completion result")).toHaveTextContent("false"))
  expect(decodeFormDraft(state.view.draft).completed).toBe(false)
  state.fail = false
  fireEvent.click(screen.getByRole("button", { name: "complete submitted" }))
  await waitFor(() => expect(screen.getByLabelText("completion result")).toHaveTextContent("true"))
  expect(decodeFormDraft(state.view.draft)).toMatchObject({ completed: true, entryId: "33333333-3333-4333-8333-333333333333", input: { memo: "SYNTHETIC_RETRY" } })
})
