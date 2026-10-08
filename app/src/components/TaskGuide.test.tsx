import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TaskGuide } from "./TaskGuide"

afterEach(cleanup)

describe("task orientation", () => {
  it("keeps a real focused heading and purpose when its optional image fails", () => {
    const heading = React.createRef<HTMLHeadingElement>()
    const action = vi.fn()
    const { container } = render(<><TaskGuide as="h1" ref={heading} tabIndex={-1} id="task-title"
      title="기록 살펴보기" description="볼 항목을 골라 주세요." illustration="training-map" />
      <button onClick={action}>훈련량 보기</button></>)
    const title = screen.getByRole("heading", { level: 1, name: "기록 살펴보기" })
    expect(title).toHaveAttribute("id", "task-title")
    expect(heading.current).toBe(title)
    heading.current?.focus()
    expect(title).toHaveFocus()
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(title).toBeVisible()
    expect(screen.getByText("볼 항목을 골라 주세요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "훈련량 보기" }))
    expect(action).toHaveBeenCalledOnce()
  })

  it("adds neither empty explanation nor placeholder image when only a title is useful", () => {
    const { container } = render(<TaskGuide title="바뀐 훈련 확인" />)
    expect(screen.getByRole("heading", { level: 2, name: "바뀐 훈련 확인" })).toBeVisible()
    expect(container.querySelector("img, p, button, [role=status]")).toBeNull()
  })
})
