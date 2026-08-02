import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Guide } from "./Guide"

afterEach(cleanup)

describe("guide feedback entry", () => {
  it("keeps error and feedback reports inside TrainOracle", () => {
    render(<Guide />)

    const link = screen.getByRole("link", { name: "문의 게시판 열기" })
    expect(link).toHaveAttribute("href", "?feedback=1")
    expect(screen.queryByText(/GitHub Issues/u)).toBeNull()
  })
})
