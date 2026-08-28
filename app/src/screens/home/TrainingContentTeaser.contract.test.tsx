import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TrainingContentTeaser } from "./TrainingContentTeaser"

afterEach(cleanup)

describe("training content home teaser", () => {
  it("offers a concrete article without claiming plan activation", () => {
    const onOpen = vi.fn()
    render(<TrainingContentTeaser onOpen={onOpen} />)

    expect(screen.getByRole("region", { name: "요즘 주목받는 훈련법" })).toBeVisible()
    expect(screen.getByText("더블 스레숄드")).toBeVisible()
    expect(screen.getByText(/훈련 계획은 자동으로 바뀌지 않아요/u)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "더블 스레숄드 읽기" }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
