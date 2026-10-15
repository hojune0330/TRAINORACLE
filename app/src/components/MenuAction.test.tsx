import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { Calculator, ShieldCheck } from "lucide-react"
import { MenuAction } from "./MenuAction"

afterEach(cleanup)

it("opens its one destination with the keyboard and leaves an identifiable return target", async () => {
  const open = vi.fn()
  const user = userEvent.setup()
  render(<MenuAction category="training" icon={Calculator} label="페이스 계산" detail="기록으로 구간 시간을 확인해요" onClick={open} />)
  const action = screen.getByRole("button", { name: "페이스 계산" })
  expect(action).toHaveAccessibleDescription("기록으로 구간 시간을 확인해요")
  await user.tab()
  await user.keyboard("{Enter}")
  expect(open).toHaveBeenCalledOnce()
  expect(action).toHaveFocus()
  expect(action).not.toHaveAttribute("aria-pressed")
})

it("keeps the destination and description available after its optional artwork fails", () => {
  const open = vi.fn()
  const { container } = render(<MenuAction category="training" icon={Calculator} label="페이스 계산"
    detail="구간 시간 보기" illustration="pace-calculator-announcement" onClick={open} />)
  const artwork = container.querySelector("img")!
  expect(artwork).toHaveAttribute("width", "64")
  expect(screen.queryByRole("img")).toBeNull()
  fireEvent.error(artwork)
  expect(container.querySelector("img")).toBeNull()
  const action = screen.getByRole("button", { name: "페이스 계산" })
  expect(action).toHaveAccessibleDescription("구간 시간 보기")
  fireEvent.click(action)
  expect(open).toHaveBeenCalledOnce()
})

it("keeps public documents as native links and identifies a new window", () => {
  render(<MenuAction icon={ShieldCheck} label="개인정보처리방침" href="./legal/privacy.html" target="_blank" />)
  const link = screen.getByRole("link", { name: "개인정보처리방침 (새 창)" })
  expect(link).toHaveAttribute("href", "./legal/privacy.html")
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", "noreferrer")
  expect(screen.queryByRole("button")).toBeNull()
})
