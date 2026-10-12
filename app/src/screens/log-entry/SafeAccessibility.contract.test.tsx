import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { EveningCheckin } from "./EveningCheckin"
import { PostSessionForm } from "./PostSessionForm"

afterEach(cleanup)

describe("form input names", () => {
  it("names each adjacent post-session input when its question is active", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    expect(screen.getByRole("textbox", { name: "세션 제목" })).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "거리 (km)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    expect(screen.getByRole("textbox", { name: "거리 (km)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "시간 (분)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "평균 페이스 (/km)" })).toBeVisible()
  })

  it("names controls in the active evening step and keeps optional measures grouped", async () => {
    const user = userEvent.setup()
    render(<EveningCheckin />)

    await user.click(screen.getByRole("button", { name: "수면" }))
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toHaveAttribute("inputmode", "decimal")
    expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: "몸 상태 · 기분 입력" }))
    expect(screen.getByRole("button", { name: "감정 4 좋음" })).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: "체중 · 안정시 심박 입력" }))
    expect(screen.getByRole("textbox", { name: "체중 (kg)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "안정시 심박 (bpm)" })).toBeVisible()
  })
})

describe("selector state", () => {
  it("exposes the selected energy system and RPE as pressed", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)
    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    const vo2 = screen.getByRole("button", { name: /VO₂ 강한 유산소 반복/u })

    expect(screen.getAllByRole("button", { name: /^(?:REC|BASE|LT|VO₂|GLY|ATP-PC|MIX) /u })
      .every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true)
    expect(vo2).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "6" })).toBeNull()
    await user.click(vo2)
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    const rpeSix = screen.getByRole("button", { name: "6" })
    expect(rpeSix).toHaveAttribute("aria-pressed", "false")
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
  it("uses the static guide image and named buttons while the drawing stays noninteractive", () => {
    const { container } = render(<BodyDiagram />)
    const bodyPartButtons = screen.getAllByRole("button")
    const guide = container.querySelector(".body-pain-selector__visual img")

    expect(bodyPartButtons).toHaveLength(10)
    expect(bodyPartButtons.every((button) => button.tagName === "BUTTON")).toBe(true)
    expect(guide?.getAttribute("src")).toMatch(/\/illustrations\/body-check-guide-v1\.webp$/u)
    expect(guide?.closest("button")).toBeNull()
    expect(container.querySelector("svg")).toBeNull()
    expect(container.querySelector("[data-diagram-open]")).toBeNull()
  })

  it("opens a named part by keyboard and selects a direct level", async () => {
    // Given
    const user = userEvent.setup()
    const onChange = vi.fn()
    const view = render(<BodyDiagram onChange={onChange} />)
    const rightKnee = screen.getByRole("button", { name: "오른 무릎" })
    const parts = view.container.querySelector(".body-pain-selector__buttons")
    const partPosition = Array.from(parts?.children ?? []).indexOf(rightKnee.parentElement as HTMLElement)

    // When
    rightKnee.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("heading", { name: "오른 무릎 통증 정도" })).toBeVisible()
    expect(rightKnee).toHaveAttribute("aria-expanded", "true")
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "오른 무릎 통증 1단계" }))
    await user.keyboard(" ")

    // Then
    expect(onChange).toHaveBeenCalledWith({ rKnee: 1 })
    expect(Array.from(parts?.children ?? []).indexOf(rightKnee.parentElement as HTMLElement)).toBe(partPosition)
    expect(screen.getByText("약함")).toBeVisible()
    expect(screen.getByText("심함")).toBeVisible()
    view.rerender(<BodyDiagram selected={{ rKnee: 1 }} onChange={onChange} />)
    expect(screen.getByRole("button", { name: "오른 무릎 통증 1단계" })).toHaveAttribute("aria-pressed", "true")
  })

  it("lets a saved level be changed or explicitly cleared without inventing zero-filled parts", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram selected={{ rKnee: 3 }} onChange={onChange} />)
    const rightKnee = screen.getByRole("button", { name: "오른 무릎, 통증 3/5" })

    await user.click(rightKnee)
    expect(screen.getByRole("heading", { name: "오른 무릎 통증 정도" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오른 무릎 통증 5단계" }))
    expect(onChange).toHaveBeenNthCalledWith(1, { rKnee: 5 })
    await user.click(screen.getByRole("button", { name: "오른 무릎 통증 해제" }))
    expect(onChange).toHaveBeenNthCalledWith(2, {})
  })
})
