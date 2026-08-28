import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { PostSessionForm } from "./PostSessionForm"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("planned session journal entry", () => {
  it("shows the selected plan occurrence and preserves its link without pre-filling actual effort", async () => {
    const state = stateFixture()
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(state, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")
    const user = userEvent.setup()
    const onDone = vi.fn()

    render(<PostSessionForm targetDate={draft.date} plannedSessionLink={draft.link} onDone={onDone} />)

    expect(screen.getByText(/계획의 DAY 1 오전 훈련/u)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "BASE 기초 지구력" })).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: /저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const saved = onDone.mock.calls[0]?.[1]
    expect(saved?.plannedSessionLink).toEqual(draft.link)
    expect(saved?.system).toBe("")
    expect(saved?.date).toBe(draft.date)
  })
})
