import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useJournalPageTurn } from "./useJournalPageTurn"

afterEach(cleanup)

function Harness({ previous, next, blocked }: {
  readonly previous: () => void
  readonly next: () => void
  readonly blocked?: "editor" | "dialog" | "alertdialog"
}) {
  const turn = useJournalPageTurn({ onPrevious: previous, onNext: next })
  return <main data-testid="reader" {...turn.touchHandlers}>
    <span data-testid="drag">{turn.dragOffset}</span>
    <div className={blocked === "editor" ? "journal-decoration-workspace--open" : undefined}
      role={blocked === "dialog" || blocked === "alertdialog" ? blocked : undefined}>
      <span data-testid="surface">reading surface</span>
    </div>
  </main>
}

const touch = (x: number, y = 80) => ({ clientX: x, clientY: y, identifier: 1 })

function swipe(target: HTMLElement, from: number, to: number): void {
  fireEvent.touchStart(target, { touches: [touch(from)], changedTouches: [touch(from)] })
  fireEvent.touchMove(target, { touches: [touch(to)], changedTouches: [touch(to)] })
  fireEvent.touchEnd(target, { touches: [], changedTouches: [touch(to)] })
}

describe("journal page gesture ownership", () => {
  it("keeps ordinary interior swipes and arrow navigation working", () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness previous={previous} next={next} />)
    swipe(screen.getByTestId("surface"), 200, 100)
    swipe(screen.getByTestId("surface"), 100, 200)
    fireEvent.keyDown(screen.getByTestId("surface"), { key: "ArrowRight" })
    expect(previous).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("drag")).toHaveTextContent("0")
  })

  it("leaves both browser edge gestures free without dragging or turning a page", () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness previous={previous} next={next} />)
    const surface = screen.getByTestId("surface")
    fireEvent.touchStart(surface, { touches: [touch(24)], changedTouches: [touch(24)] })
    fireEvent.touchMove(surface, { touches: [touch(180)], changedTouches: [touch(180)] })
    expect(screen.getByTestId("drag")).toHaveTextContent("0")
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(180)] })
    swipe(surface, window.innerWidth - 24, window.innerWidth - 180)
    expect(previous).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it.each(["editor", "dialog", "alertdialog"] as const)("does not turn the reader inside an open %s", blocked => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness previous={previous} next={next} blocked={blocked} />)
    swipe(screen.getByTestId("surface"), 200, 100)
    fireEvent.keyDown(screen.getByTestId("surface"), { key: "ArrowLeft" })
    expect(previous).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it("abandons an interior swipe when a second finger joins, even if it leaves before touchend", () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness previous={previous} next={next} />)
    const surface = screen.getByTestId("surface")
    fireEvent.touchStart(surface, { touches: [touch(200)], changedTouches: [touch(200)] })
    fireEvent.touchMove(surface, { touches: [touch(100)], changedTouches: [touch(100)] })
    expect(screen.getByTestId("drag")).not.toHaveTextContent(/^0$/)
    fireEvent.touchMove(surface, { touches: [touch(100), touch(180)], changedTouches: [touch(180)] })
    expect(screen.getByTestId("drag")).toHaveTextContent("0")
    fireEvent.touchMove(surface, { touches: [touch(80)], changedTouches: [touch(80)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(80)] })
    expect(next).not.toHaveBeenCalled()
  })

  it("rejects multitouch starts, partial releases, cancelled touches and vertical motion", () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness previous={previous} next={next} />)
    const surface = screen.getByTestId("surface")
    fireEvent.touchStart(surface, { touches: [touch(200), touch(180)], changedTouches: [touch(200)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(80)] })
    fireEvent.touchStart(surface, { touches: [touch(200)], changedTouches: [touch(200)] })
    fireEvent.touchEnd(surface, { touches: [touch(180)], changedTouches: [touch(80)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(80)] })
    fireEvent.touchStart(surface, { touches: [touch(200)], changedTouches: [touch(200)] })
    fireEvent.touchCancel(surface)
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(80)] })
    fireEvent.touchStart(surface, { touches: [touch(200)], changedTouches: [touch(200)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(100, 280)] })
    expect(previous).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})
