import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PrivateMemoVault } from "./PrivateMemoVault"

afterEach(cleanup)

describe("private memo recovery code", () => {
  it("creates a recovery code and explains that the service operator cannot recover it", async () => {
    const saveCode = vi.fn().mockReturnValue(true)
    render(<PrivateMemoVault onSaveCode={saveCode} />)

    await userEvent.click(screen.getByRole("button", { name: "새 복구 코드 만들기" }))

    expect(screen.getByTestId("recovery-code")).toHaveTextContent(/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/u)
    expect(screen.getByText(/서비스 운영자도 대신 복구할 수 없어요/u)).toBeVisible()
    expect(saveCode).toHaveBeenCalledTimes(1)
  })

  it("accepts an existing code for this browser session", async () => {
    const saveCode = vi.fn().mockReturnValue(true)
    render(<PrivateMemoVault onSaveCode={saveCode} />)
    const code = "ABCD-EF12-3456-7890-ABCD-EF12-3456-7890"

    await userEvent.type(screen.getByLabelText("기존 복구 코드"), code)
    await userEvent.click(screen.getByRole("button", { name: "이 세션에서 메모 열기" }))

    expect(saveCode).toHaveBeenCalledWith(code)
  })
})
