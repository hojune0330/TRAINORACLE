import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EraseLocalData } from "./EraseLocalData"

afterEach(cleanup)

describe("EraseLocalData recovery surface", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem("trainoracle.journal.v1", "[]")
  })

  it("offers a real backup action and explains the deletion scope before confirmation", () => {
    render(<EraseLocalData />)

    expect(screen.getByRole("button", { name: /일지 데이터 내려받기/u })).toBeVisible()
    expect(screen.getByText(/일지.*계획.*포인트.*로그인/u)).toBeVisible()
  })

  it("offers the restore route after local deletion", async () => {
    const user = userEvent.setup()
    const onOpenRestore = vi.fn()
    render(<EraseLocalData onOpenRestore={onOpenRestore} />)

    await user.click(screen.getByTestId("erase-start"))
    await user.click(screen.getByTestId("erase-confirm"))
    await user.click(screen.getByRole("button", { name: "백업 파일 되돌리기" }))

    expect(onOpenRestore).toHaveBeenCalledOnce()
  })
})
