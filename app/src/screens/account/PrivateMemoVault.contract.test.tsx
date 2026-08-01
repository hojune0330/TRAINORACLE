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

  it("rotates an unlocked recovery code exactly once and displays the replacement", async () => {
    const previousCode = "ABCD-EF12-3456-7890-ABCD-EF12-3456-7890"
    const rotateCode = vi.fn().mockResolvedValue({ ok: true })
    render(<PrivateMemoVault onLoadCode={() => previousCode} onRotateCode={rotateCode} />)

    await userEvent.click(screen.getByRole("button", { name: "새 복구 코드 만들기" }))

    await vi.waitFor(() => expect(rotateCode).toHaveBeenCalledTimes(1))
    expect(rotateCode).toHaveBeenCalledWith(previousCode, expect.stringMatching(/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/u))
    expect(screen.getByTestId("recovery-code")).toHaveTextContent(/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/u)
  })

  it("prevents another recovery-code rotation while the current rotation is pending", async () => {
    const previousCode = "ABCD-EF12-3456-7890-ABCD-EF12-3456-7890"
    let resolveRotation: ((result: { readonly ok: boolean }) => void) | undefined
    const rotateCode = vi.fn(() => new Promise<{ readonly ok: boolean }>((resolve) => {
      resolveRotation = resolve
    }))
    render(<PrivateMemoVault onLoadCode={() => previousCode} onRotateCode={rotateCode} />)
    const [createButton] = screen.getAllByRole("button")
    if (createButton === undefined) throw new Error("The recovery-code creation control is missing.")
    const user = userEvent.setup()

    await user.click(createButton)
    await user.click(createButton)

    expect(rotateCode).toHaveBeenCalledTimes(1)
    expect(createButton).toBeDisabled()
    expect(screen.queryByTestId("recovery-code")).not.toBeInTheDocument()

    if (resolveRotation === undefined) throw new Error("The pending rotation did not provide a resolver.")
    resolveRotation({ ok: false })
    await vi.waitFor(() => expect(createButton).toBeEnabled())
    expect(screen.queryByTestId("recovery-code")).not.toBeInTheDocument()

    await user.click(createButton)
    expect(rotateCode).toHaveBeenCalledTimes(2)
  })
})
