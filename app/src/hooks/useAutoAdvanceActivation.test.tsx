import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isRepeatedAnswerActivation, useAutoAdvanceActivation } from "./useAutoAdvanceActivation"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const previous = { question: "days", at: 1000, detail: 1, point: { x: 180, y: 220 } }
describe("single-answer repeated activation boundary", () => {
  it("blocks the previous answer's native multi-click and same-position touch repeat only across questions", () => {
    expect(isRepeatedAnswerActivation(previous, { ...previous, question: "safety", at: 1080 })).toBe(true)
    expect(isRepeatedAnswerActivation(previous, { ...previous, question: "safety", at: 1900, detail: 2 })).toBe(true)
    expect(isRepeatedAnswerActivation(previous, { ...previous, at: 1080 })).toBe(false)
  })
  it("allows deliberate new locations, later taps, keyboard, and coordinate-free assistive clicks", () => {
    for (const changed of [{ point: { x: 180, y: 350 } }, { at: 1500 }, { detail: 0 }, { point: null }, { at: 900 }]) {
      expect(isRepeatedAnswerActivation(previous, { ...previous, question: "safety", at: 1080, ...changed })).toBe(false)
    }
  })
  it("ignores non-answer commands and only suppresses a held Enter or Space on an answer", () => {
    const answer = vi.fn(), command = vi.fn(), keys = vi.fn()
    function Fixture() {
      const [question, setQuestion] = React.useState("first")
      const guard = useAutoAdvanceActivation(question)
      return <section {...guard} onKeyDown={keys}>
        <button data-auto-advance type="button" onClick={() => { answer(); setQuestion("second") }}>Answer</button>
        <button type="button" onClick={command}>Back</button>
      </section>
    }
    vi.spyOn(performance, "now").mockReturnValue(1000)
    render(<Fixture />)
    const button = screen.getByRole("button", { name: "Answer" })
    fireEvent.click(button, { detail: 1, clientX: 180, clientY: 220 })
    fireEvent.click(button, { detail: 2, clientX: 180, clientY: 220 })
    expect(answer).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Back" }), { detail: 2, clientX: 180, clientY: 220 })
    expect(command).toHaveBeenCalledTimes(1)
    for (const key of ["Enter", " "]) fireEvent.keyDown(button, { key, repeat: true })
    expect(keys).not.toHaveBeenCalled()
    fireEvent.keyDown(button, { key: "Enter", repeat: false })
    fireEvent.keyDown(button, { key: "ArrowDown", repeat: true })
    expect(keys).toHaveBeenCalledTimes(2)
    fireEvent.click(button, { detail: 0 })
    expect(answer).toHaveBeenCalledTimes(2)
  })
})
