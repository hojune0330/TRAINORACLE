import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadDailyContext } from "../../domain/daily-context"
import { DailyContextTags } from "./DailyContextTags"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

describe("today context tags", () => {
  it("lets the user choose weather without requesting location", async () => {
    const user = userEvent.setup()
    render(<DailyContextTags date="2026-08-01" />)

    await user.click(screen.getByRole("button", { name: "날씨 맑음" }))
    await user.click(screen.getByRole("button", { name: "기분 좋음" }))
    await user.click(screen.getByRole("button", { name: "몸 상태 보통" }))

    expect(loadDailyContext("2026-08-01")).toMatchObject({ weather: "SUNNY", mood: "GOOD", body: "NORMAL" })
    expect(document.body.textContent).toContain("위치정보를 사용하지 않아요")
  })
})
