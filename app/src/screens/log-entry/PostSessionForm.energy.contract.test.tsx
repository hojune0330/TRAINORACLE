import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PostSessionForm } from "./PostSessionForm"

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("post-session energy provenance", () => {
  it("saves an untouched energy system as missing instead of defaulting to BASE", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PostSessionForm onDone={onDone} />)

    await user.click(screen.getByRole("button", { name: /저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const entry = onDone.mock.calls[0]?.[1]

    expect(entry?.kind).toBe("post-session")
    if (entry?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(entry.system).toBe("")
    expect(entry.fieldProvenance?.system).toEqual({ provenance: "MISSING" })
  })

  it("records the system only after the user directly chooses it", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PostSessionForm onDone={onDone} />)

    await user.click(screen.getByRole("button", { name: "LT 지속 페이스" }))
    await user.click(screen.getByRole("button", { name: /저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const entry = onDone.mock.calls[0]?.[1]

    expect(entry?.kind).toBe("post-session")
    if (entry?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(entry.system).toBe("lt")
    expect(entry.fieldProvenance?.system).toEqual({ provenance: "EXPLICIT" })
  })
})
