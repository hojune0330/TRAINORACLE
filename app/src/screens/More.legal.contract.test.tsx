import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

describe("more legal documents", () => {
  it("keeps both public legal documents one tap away", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)

    expect(screen.getByRole("link", { name: /^개인정보처리방침/u })).toHaveAttribute(
      "href",
      "./legal/privacy.html",
    )
    expect(screen.getByRole("link", { name: /^이용약관/u })).toHaveAttribute(
      "href",
      "./legal/terms.html",
    )
  })
})
