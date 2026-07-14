import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { EveningCheckin } from "./EveningCheckin"
import { PostSessionForm } from "./PostSessionForm"

afterEach(cleanup)

describe("form input names", () => {
  it("names each adjacent post-session input", () => {
    render(<PostSessionForm />)

    expect(screen.getByRole("textbox", { name: "세션 제목" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "거리 (km)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "시간 (분)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "평균 페이스 (/km)" })).toBeVisible()
  })

  it("names the evening slider and adjacent body inputs", () => {
    render(<EveningCheckin />)

    expect(screen.getByRole("slider", { name: "수면 시간" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "체중 (kg)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "안정시 심박 (bpm)" })).toBeVisible()
  })
})

describe("selector state", () => {
  it("exposes the selected energy system and RPE as pressed", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)
    const vo2 = screen.getByRole("button", { name: /V2 VO2/u })
    const rpeSix = screen.getByRole("button", { name: "6" })

    expect(vo2).toHaveAttribute("aria-pressed", "false")
    expect(rpeSix).toHaveAttribute("aria-pressed", "false")
    await user.click(vo2)
    await user.click(rpeSix)
    expect(vo2).toHaveAttribute("aria-pressed", "true")
    expect(rpeSix).toHaveAttribute("aria-pressed", "true")
  })
})

describe("high-pain review guidance", () => {
  it("asks for human review without claiming the plan was held", () => {
    // Given
    render(<PainReviewBanner />)

    // When
    const guidance = screen.getByRole("status")

    // Then
    expect(guidance).not.toHaveTextContent("계획이 보류")
    expect(guidance).toHaveTextContent(/사람.*확인/u)
    expect(guidance).toHaveTextContent(/지도자.*보호자.*상의/u)
  })
})

describe("body pain keyboard controls", () => {
  it("cycles a pain hotspot with the keyboard", async () => {
    // Given
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram onChange={onChange} />)
    const rightKnee = screen.getByRole("button", { name: /오른 무릎.*통증 없음/u })

    // When
    rightKnee.focus()
    await user.keyboard("{Enter}")

    // Then
    expect(onChange).toHaveBeenCalledWith({ rKnee: 1 })
  })
})
