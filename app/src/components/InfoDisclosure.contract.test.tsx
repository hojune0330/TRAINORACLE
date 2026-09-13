import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { InfoDisclosure } from "./InfoDisclosure"

afterEach(cleanup)

describe("optional explanation disclosure", () => {
  it("shows a topic-specific entry and hides only the supporting explanation until opened", () => {
    render(<>
      <p role="alert">저장하지 못했어요. 다시 시도해 주세요.</p>
      <InfoDisclosure title="기록은 어디에 보관되나요?"><p>선택해서 읽는 저장 설명</p></InfoDisclosure>
    </>)
    const summary = screen.getByText("기록은 어디에 보관되나요?")
    const content = screen.getByText("선택해서 읽는 저장 설명")
    expect(summary).toBeVisible()
    expect(summary.closest("details")).not.toHaveAttribute("open")
    expect(content).not.toBeVisible()
    expect(screen.getByRole("alert")).toBeVisible()
    fireEvent.click(summary)
    expect(content).toBeVisible()
    fireEvent.click(summary)
    expect(content).not.toBeVisible()
    expect(screen.getByRole("alert")).toBeVisible()
  })

  it("uses native disclosure, a touch-size summary, focus indication and reduced motion", () => {
    const css = readFileSync("src/components/InfoDisclosure.css", "utf8")
    const { container } = render(<InfoDisclosure title="계산 기준"><a href="#source">출처</a></InfoDisclosure>)
    expect(container.querySelector("details > summary")).not.toBeNull()
    expect(container.querySelector("summary button, summary a")).toBeNull()
    expect(css).toContain("min-height: var(--app-touch-min, 44px)")
    expect(css).toContain(":focus-visible")
    expect(css).toContain("prefers-reduced-motion: reduce")
    expect(css).not.toContain("line-clamp")
  })
})
