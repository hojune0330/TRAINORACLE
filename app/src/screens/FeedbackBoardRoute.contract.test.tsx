import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { FeedbackBoardRoute } from "./FeedbackBoardRoute"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("feedback board route", () => {
  it("shows a recoverable error surface when its code chunk fails to load", async () => {
    const load = async () => Promise.reject(new Error("feedback chunk unavailable"))
    render(<ErrorBoundary><FeedbackBoardRoute load={load} /></ErrorBoundary>)

    expect(await screen.findByTestId("error-boundary")).toBeVisible()
    expect(screen.getByRole("heading", { name: "화면을 여는 중 문제가 생겼어요" })).toBeVisible()
  })
})
